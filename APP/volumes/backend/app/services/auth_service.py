# services/auth_service.py
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session
from starlette.requests import Request

from core.config import settings
from core.exceptions import UnauthorizedException, ForbiddenException
from core.security import verify_password, create_access_token, decode_access_token, hash_password
from db.redis import get_redis
from models.user import User
from repositories.auth_repository import get_user_by_credential, get_user_with_roles_permissions, get_user_full, get_user_by_id
from repositories.session_repository import create_session, mark_logout, get_user_sessions, get_session_by_jti, get_active_sessions, revoke_all_sessions
from schemas.auth import TokenResponse, UserSession, MeResponse, UserProfileData, ConnectionInfo, ValidateTokenResponse, ChangePasswordRequest,    ChangePasswordByAdminRequest, TokenResponse
from utils.device import get_device_string
from utils.geo import get_geo
from utils.network import get_client_ip
from jose import jwt as jose_jwt
from repositories.audit_repository import write_audit

_SESSION_PREFIX = "session"


def _session_key(user_id: str, jti: str) -> str:
    return f"{_SESSION_PREFIX}:{user_id}:{jti}"


def _build_user_session(user: User) -> UserSession:
    roles: list[str] = []
    permissions: set[str] = set()

    for user_role in user.roles:
        if user_role.deleted_at is not None:
            continue
        role = user_role.role
        if not role or not role.is_active:
            continue
        roles.append(role.code)
        for rp in role.permissions:
            if rp.deleted_at is None and rp.permission and rp.permission.is_active:
                permissions.add(rp.permission.code)

    return UserSession(
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        roles=roles,
        permissions=sorted(permissions),
        jti=str(uuid.uuid4()),
    )


async def login(db: Session, credential: str, password: str, request: Request) -> TokenResponse:
    user = get_user_by_credential(db, credential)

    if not user or not verify_password(password, user.password_hash):
        raise UnauthorizedException("Credenciales inválidas")

    if not user.is_active:
        raise ForbiddenException("Cuenta desactivada")

    # ── Geo + Device ──────────────────────────────────
    ip_v4, ip_v6 = get_client_ip(request)
    ip = ip_v4 or ip_v6
    geo = get_geo(ip) if ip else {}
    user_agent_str = request.headers.get("User-Agent")
    device = get_device_string(user_agent_str)

    # ── Cargar roles/permisos ─────────────────────────
    user_full = get_user_with_roles_permissions(db, user.id)
    session = _build_user_session(user_full)

    expires = timedelta(minutes=settings.jwt_expire_minutes)
    token = create_access_token(
        subject=session.user_id,
        extra={"jti": session.jti, "roles": session.roles, "permissions": session.permissions},
        expires_delta=expires,
    )

    redis = get_redis()
    ttl = int(expires.total_seconds())
    await redis.setex(_session_key(session.user_id, session.jti), ttl, token)

    # ── Persistir sesión ──────────────────────────────
    create_session(
        db,
        user_id      = user.id,
        jti          = session.jti,
        ip_v4        = ip_v4,
        ip_v6        = ip_v6,
        user_agent   = user_agent_str,
        device       = device,
        country_code = geo.get("country_code"),
        country_name = geo.get("country_name"),
        city         = geo.get("city"),
        location     = geo.get("location"),
    )

    # ── Actualizar last_login_at ──────────────────────
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    return TokenResponse(access_token=token, expires_in=ttl)


async def logout(session: UserSession, db: Session) -> None:
    redis = get_redis()
    await redis.delete(_session_key(session.user_id, session.jti))
    mark_logout(db, session.jti)


async def get_current_user(token: str) -> UserSession:
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    jti     = payload.get("jti")

    if not user_id or not jti:
        raise UnauthorizedException()

    redis = get_redis()
    exists = await redis.exists(_session_key(user_id, jti))
    if not exists:
        raise UnauthorizedException("Sesión expirada o cerrada")

    return UserSession(
        user_id=user_id,
        username=payload.get("username", ""),
        full_name=payload.get("full_name"),
        roles=payload.get("roles", []),
        permissions=payload.get("permissions", []),
        jti=jti,
    )


async def get_me(token: str, db: Session) -> MeResponse:
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    jti     = payload.get("jti")

    if not user_id or not jti:
        raise UnauthorizedException()

    redis = get_redis()
    exists = await redis.exists(_session_key(user_id, jti))
    if not exists:
        raise UnauthorizedException("Sesión expirada o cerrada")

    user = get_user_full(db, user_id)
    if not user:
        raise UnauthorizedException("Usuario no encontrado")

    # ── Perfil ────────────────────────────────────────
    profile = None
    if user.profile:
        profile = UserProfileData(
            initials   = user.profile.initials,
            color      = user.profile.color,
            position   = user.profile.position,
            department = user.profile.department,
        )

    # ── Sesiones ──────────────────────────────────────
    sessions = get_user_sessions(db, user_id, limit=11)

    active_connection = None
    last_connections  = []

    for s in sessions:
        conn = ConnectionInfo(
            ts       = s.created_at.isoformat(),
            device   = s.device,
            location = s.location,
            ip_v4    = s.ip_v4,
            ip_v6    = s.ip_v6,
        )
        if s.jti == jti:
            active_connection = conn
        else:
            last_connections.append(conn)

    return MeResponse(
        user_id           = user.id,
        username          = user.username,
        full_name         = user.full_name,
        description       = user.description,
        job_title         = user.job_title,
        email             = user.email,
        phone             = user.phone,
        area              = user.area,
        roles             = payload.get("roles", []),
        permissions       = payload.get("permissions", []),
        is_active         = user.is_active,
        last_login_at     = user.last_login_at.isoformat() if user.last_login_at else None,
        profile           = profile,
        active_connection = active_connection,
        last_connections  = last_connections[:10],
    )

async def refresh_token(token: str, db: Session, request: Request) -> TokenResponse:
    """Invalida el token actual y emite uno nuevo manteniendo la sesión."""
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    jti     = payload.get("jti")

    if not user_id or not jti:
        raise UnauthorizedException()

    redis = get_redis()
    exists = await redis.exists(_session_key(user_id, jti))
    if not exists:
        raise UnauthorizedException("Sesión expirada o cerrada")

    # Baja el token viejo
    await redis.delete(_session_key(user_id, jti))
    mark_logout(db, jti)

    # Carga usuario fresco
    user_full = get_user_with_roles_permissions(db, user_id)
    if not user_full:
        raise UnauthorizedException()

    session = _build_user_session(user_full)

    # Captura datos de conexión para la nueva sesión
    ip_v4, ip_v6 = get_client_ip(request)
    ip = ip_v4 or ip_v6
    geo = get_geo(ip) if ip else {}
    user_agent_str = request.headers.get("User-Agent")
    device = get_device_string(user_agent_str)

    expires = timedelta(minutes=settings.jwt_expire_minutes)
    new_token = create_access_token(
        subject=session.user_id,
        extra={"jti": session.jti, "roles": session.roles, "permissions": session.permissions},
        expires_delta=expires,
    )

    ttl = int(expires.total_seconds())
    await redis.setex(_session_key(session.user_id, session.jti), ttl, new_token)

    create_session(
        db,
        user_id      = user_id,
        jti          = session.jti,
        ip_v4        = ip_v4,
        ip_v6        = ip_v6,
        user_agent   = user_agent_str,
        device       = device,
        country_code = geo.get("country_code"),
        country_name = geo.get("country_name"),
        city         = geo.get("city"),
        location     = geo.get("location"),
    )

    return TokenResponse(access_token=new_token, expires_in=ttl)


async def validate_token(token: str) -> ValidateTokenResponse:
    """Valida JWT + existencia en Redis. No toca DB."""
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        jti     = payload.get("jti")

        if not user_id or not jti:
            return ValidateTokenResponse(valid=False)

        redis = get_redis()
        exists = await redis.exists(_session_key(user_id, jti))
        if not exists:
            return ValidateTokenResponse(valid=False)

        # Calcular segundos restantes
        exp = payload.get("exp", 0)
        now = datetime.now(timezone.utc).timestamp()
        expires_in = max(0, int(exp - now))

        return ValidateTokenResponse(valid=True, user_id=user_id, expires_in=expires_in)

    except Exception:
        return ValidateTokenResponse(valid=False)


async def change_password(
    session: UserSession,
    payload: ChangePasswordRequest,
    db: Session,
) -> None:
    user = get_user_by_id(db, session.user_id)
    if not user:
        raise UnauthorizedException()

    if not verify_password(payload.current_password, user.password_hash):
        from core.exceptions import BadRequestException
        raise BadRequestException("La contraseña actual es incorrecta")

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    if payload.revoke_sessions:
        # Revoca todas excepto la sesión actual
        jtis = [s.jti for s in get_active_sessions(db, session.user_id)
                if s.jti != session.jti]
        redis = get_redis()
        for jti in jtis:
            await redis.delete(_session_key(session.user_id, jti))
        revoke_all_sessions(db, session.user_id, exclude_jti=session.jti)


async def change_password_by_admin(
    actor: UserSession,
    payload: ChangePasswordByAdminRequest,
    db: Session,
) -> None:
    # Verificar que el actor es ADMIN
    if "ADMIN" not in actor.roles:
        from core.exceptions import ForbiddenException
        raise ForbiddenException("Solo administradores pueden usar este endpoint")

    target = get_user_by_id(db, payload.user_id)
    if not target:
        from core.exceptions import NotFoundException
        raise NotFoundException("Usuario no encontrado")

    target.password_hash = hash_password(payload.new_password)
    db.commit()

    # Revocar TODAS las sesiones del usuario afectado
    jtis = [s.jti for s in get_active_sessions(db, payload.user_id)]
    redis = get_redis()
    for jti in jtis:
        await redis.delete(_session_key(payload.user_id, jti))
    revoke_all_sessions(db, payload.user_id)

    # Auditoría
    write_audit(
        db,
        actor_user_id = actor.user_id,
        action        = "CHANGE_PASSWORD_BY_ADMIN",
        entity_type   = "user",
        entity_id     = payload.user_id,
        details       = {
            "reason":          payload.reason,
            "sessions_revoked": len(jtis),
            "target_username": target.username,
        },
    )
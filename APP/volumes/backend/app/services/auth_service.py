# services/auth_service.py
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session
from starlette.requests import Request

from core.config import settings
from core.exceptions import BadRequestException, ForbiddenException, UnauthorizedException
from core.security import verify_password, create_access_token, decode_access_token, hash_password
from db.redis import get_redis
from models.user import User
from repositories.auth_repository import get_user_by_credential, get_user_with_roles_permissions, get_user_full, get_user_by_id
from repositories.session_repository import create_session, mark_logout, get_user_sessions, get_session_by_jti, get_active_sessions, revoke_all_sessions
from schemas.auth import (
    TokenResponse,
    UserSession,
    MeResponse,
    UserProfileData,
    ConnectionInfo,
    ActiveSessionInfo,
    ActiveSessionsResponse,
    LogoutSessionRequest,
    LogoutSessionResponse,
    LogoutAllSessionsResponse,
    ValidateTokenResponse,
    ChangePasswordRequest,
    ChangePasswordByAdminRequest,
)
from services.notification_service import (
    consume_password_reset_otp,
    consume_password_reset_token,
    enqueue_password_changed_email,
    enqueue_recover_password_email,
)
from services.notification_center_service import create_in_app_notification
from services.session_events_service import (
    get_session_redis_key,
    publish_session_event,
    session_exists,
)
from services.avatar_service import get_avatar_url_if_exists
from utils.device import get_device_string
from utils.geo import get_geo
from utils.network import get_client_ip
from jose import jwt as jose_jwt
from repositories.audit_repository import write_audit

async def _is_session_online(user_id: str, jti: str) -> bool:
    return await session_exists(user_id, jti)


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
    await redis.setex(get_session_redis_key(session.user_id, session.jti), ttl, token)

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
    await redis.delete(get_session_redis_key(session.user_id, session.jti))
    mark_logout(db, session.jti)


async def list_active_sessions(session: UserSession, db: Session) -> ActiveSessionsResponse:
    sessions = get_active_sessions(db, session.user_id)
    response_sessions: list[ActiveSessionInfo] = []

    for s in sessions:
        response_sessions.append(
            ActiveSessionInfo(
                jti=s.jti,
                ts=s.created_at.isoformat(),
                device=s.device,
                location=s.location,
                ip_v4=s.ip_v4,
                ip_v6=s.ip_v6,
                is_online=await _is_session_online(session.user_id, s.jti),
                is_current=(s.jti == session.jti),
            )
        )

    return ActiveSessionsResponse(
        sessions=response_sessions
    )


async def logout_session_by_jti(
    session: UserSession,
    payload: LogoutSessionRequest,
    db: Session,
) -> LogoutSessionResponse:
    if payload.jti == session.jti:
        raise BadRequestException("No puedes cerrar la sesión actual desde esta acción")

    target_session = get_session_by_jti(db, payload.jti)
    if not target_session or target_session.user_id != session.user_id:
        raise BadRequestException("La sesión seleccionada no existe o no pertenece a este usuario")

    await publish_session_event(
        session.user_id,
        "session_revoked",
        target_jti=payload.jti,
        actor_jti=session.jti,
        reason="manual_remote_logout",
        message="Tu sesión fue cerrada desde otro dispositivo. Vuelve a iniciar sesión para continuar.",
        force_logout=True,
        metadata={"scope": "single_session"},
    )

    redis = get_redis()
    was_online = await _is_session_online(session.user_id, payload.jti)
    await redis.delete(get_session_redis_key(session.user_id, payload.jti))

    was_active = target_session.logged_out_at is None
    if was_active:
        mark_logout(db, payload.jti)

    session_revoked = was_online or was_active

    write_audit(
        db,
        actor_user_id=session.user_id,
        action="LOGOUT_SESSION",
        entity_type="user",
        entity_id=session.user_id,
        details={
            "target_session_jti": payload.jti,
            "session_revoked": session_revoked,
        },
    )

    return LogoutSessionResponse(
        message="La sesión seleccionada fue cerrada.",
        jti=payload.jti,
        session_revoked=session_revoked,
    )


async def logout_all_other_sessions(session: UserSession, db: Session) -> LogoutAllSessionsResponse:
    sessions = [s for s in get_active_sessions(db, session.user_id) if s.jti != session.jti]
    for s in sessions:
        await publish_session_event(
            session.user_id,
            "session_revoked",
            target_jti=s.jti,
            actor_jti=session.jti,
            reason="manual_bulk_logout",
            message="Tu sesión fue cerrada desde otro dispositivo. Vuelve a iniciar sesión para continuar.",
            force_logout=True,
            metadata={"scope": "all_other_sessions"},
        )

    redis = get_redis()
    for s in sessions:
        await redis.delete(get_session_redis_key(session.user_id, s.jti))

    revoked = revoke_all_sessions(db, session.user_id, exclude_jti=session.jti)

    write_audit(
        db,
        actor_user_id=session.user_id,
        action="LOGOUT_ALL_OTHER_SESSIONS",
        entity_type="user",
        entity_id=session.user_id,
        details={"sessions_revoked": revoked},
    )

    return LogoutAllSessionsResponse(
        message="Se cerraron todas las demás sesiones activas.",
        sessions_revoked=revoked,
    )


async def get_current_user(token: str) -> UserSession:
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    jti     = payload.get("jti")

    if not user_id or not jti:
        raise UnauthorizedException()

    if not await session_exists(user_id, jti):
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

    if not await session_exists(user_id, jti):
        raise UnauthorizedException("Sesión expirada o cerrada")

    user = get_user_full(db, user_id)
    if not user:
        raise UnauthorizedException("Usuario no encontrado")

    # ── Perfil ────────────────────────────────────────
    profile = UserProfileData(
        initials   = user.profile.initials if user.profile else None,
        color      = user.profile.color if user.profile else None,
        position   = user.profile.position if user.profile else None,
        department = user.profile.department if user.profile else None,
        avatar_url = get_avatar_url_if_exists(user.id),
    )

    # ── Sesiones ──────────────────────────────────────
    sessions = get_user_sessions(db, user_id, limit=11)

    active_connection = None
    last_connections  = []

    for s in sessions:
        is_online = await _is_session_online(user_id, s.jti)
        conn = ConnectionInfo(
            ts       = s.created_at.isoformat(),
            device   = s.device,
            location = s.location,
            ip_v4    = s.ip_v4,
            ip_v6    = s.ip_v6,
            is_online = is_online,
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

    if not await session_exists(user_id, jti):
        raise UnauthorizedException("Sesión expirada o cerrada")

    # Baja el token viejo
    redis = get_redis()
    await redis.delete(get_session_redis_key(user_id, jti))
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
    await redis.setex(get_session_redis_key(session.user_id, session.jti), ttl, new_token)

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

        if not await session_exists(user_id, jti):
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
        raise BadRequestException("La contraseña actual es incorrecta")

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    await enqueue_password_changed_email(
        db,
        user_id=user.id,
        actor_label="el titular de la cuenta",
        change_reason="Cambio realizado desde sesion autenticada",
        request_origin="auth.change-password",
    )
    await create_in_app_notification(
        db,
        notification_type="auth.password.changed",
        title="Contraseña actualizada",
        message="Tu contraseña se actualizó correctamente desde una sesión autenticada.",
        level="success",
        tags=["auth", "security", "password", "auth.password.changed"],
        recipient_user_ids=[user.id],
        scope_type="user",
        scope_id=user.id,
        action_url="/settings/userProfile",
        actor_user_id=session.user_id,
        metadata={
            "event": "self_password_change",
            "revokeSessions": bool(payload.revoke_sessions),
        },
    )

    if payload.revoke_sessions:
        # Revoca todas excepto la sesión actual
        jtis = [s.jti for s in get_active_sessions(db, session.user_id)
                if s.jti != session.jti]
        for jti in jtis:
            await publish_session_event(
                session.user_id,
                "session_revoked",
                target_jti=jti,
                actor_jti=session.jti,
                reason="password_changed",
                message="Tu sesión fue cerrada porque la contraseña de la cuenta cambió. Vuelve a iniciar sesión.",
                force_logout=True,
                metadata={"scope": "password_change_revoke_others"},
            )
        redis = get_redis()
        for jti in jtis:
            await redis.delete(get_session_redis_key(session.user_id, jti))
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

    await enqueue_password_changed_email(
        db,
        user_id=target.id,
        actor_label="un administrador",
        change_reason="Cambio forzado por administrador",
        request_origin="auth.change-password-by-admin",
    )
    await create_in_app_notification(
        db,
        notification_type="auth.password.changed_by_admin",
        title="Contraseña restablecida por administración",
        message="Una persona administradora actualizó la contraseña de tu cuenta.",
        level="warning",
        tags=["auth", "security", "password", "auth.password.changed_by_admin"],
        recipient_user_ids=[target.id],
        scope_type="user",
        scope_id=target.id,
        action_url="/settings/userProfile",
        actor_user_id=actor.user_id,
        metadata={
            "event": "admin_password_change",
            "reason": payload.reason,
        },
    )

    # Revocar TODAS las sesiones del usuario afectado
    jtis = [s.jti for s in get_active_sessions(db, payload.user_id)]
    for jti in jtis:
        await publish_session_event(
            payload.user_id,
            "session_revoked",
            target_jti=jti,
            actor_jti=actor.jti,
            reason="password_changed_by_admin",
            message="Tu sesión fue cerrada porque una persona administradora actualizó la contraseña de la cuenta.",
            force_logout=True,
            metadata={"scope": "admin_password_change"},
        )
    redis = get_redis()
    for jti in jtis:
        await redis.delete(get_session_redis_key(payload.user_id, jti))
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


async def forgot_password(
    db: Session,
    email: str,
    request: Request | None = None,
) -> None:
    ip_v4, ip_v6 = get_client_ip(request) if request else (None, None)
    await enqueue_recover_password_email(
        db,
        email=email.strip().lower(),
        request_origin="auth.forgot-password",
        request_ip=ip_v4 or ip_v6,
        request_ua=request.headers.get("User-Agent") if request else None,
    )


async def reset_password(
    db: Session,
    token: str | None,
    otp_code: str | None,
    new_password: str,
) -> None:
    token_payload = None
    if token and token.strip():
        token_payload = await consume_password_reset_token(token.strip())
    elif otp_code and otp_code.strip():
        token_payload = await consume_password_reset_otp(otp_code.strip())

    if not token_payload:
        raise BadRequestException("La credencial de recuperación es inválida o expiró")

    user_id = str(token_payload.get("user_id") or "").strip()
    if not user_id:
        raise BadRequestException("Credencial de recuperación inválida")

    user = get_user_by_id(db, user_id)
    if not user or user.deleted_at is not None:
        raise BadRequestException("Usuario no encontrado para el token entregado")

    user.password_hash = hash_password(new_password)
    db.commit()

    await enqueue_password_changed_email(
        db,
        user_id=user.id,
        actor_label="el flujo de recuperacion de cuenta",
        change_reason="Restablecimiento mediante credencial de recuperacion",
        request_origin="auth.reset-password",
    )
    await create_in_app_notification(
        db,
        notification_type="auth.password.reset",
        title="Contraseña restablecida",
        message="La contraseña de tu cuenta fue restablecida mediante recuperación.",
        level="warning",
        tags=["auth", "security", "password", "auth.password.reset"],
        recipient_user_ids=[user.id],
        scope_type="user",
        scope_id=user.id,
        action_url="/login",
        actor_user_id=user.id,
        metadata={
            "event": "password_reset",
            "usedToken": bool(token and token.strip()),
            "usedOtp": bool(otp_code and otp_code.strip()),
        },
    )

    jtis = [s.jti for s in get_active_sessions(db, user_id)]
    for jti in jtis:
        await publish_session_event(
            user_id,
            "session_revoked",
            target_jti=jti,
            actor_jti=None,
            reason="password_reset",
            message="Tu sesión fue cerrada porque la contraseña de la cuenta fue restablecida.",
            force_logout=True,
            metadata={"scope": "password_reset"},
        )
    redis = get_redis()
    for jti in jtis:
        await redis.delete(get_session_redis_key(user_id, jti))
    revoke_all_sessions(db, user_id)

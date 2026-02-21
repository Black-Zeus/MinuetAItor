# services/teams_service.py
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

import bcrypt
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from models.user import User
from models.user_profiles import UserProfile, AssignmentModeEnum
from models.user_roles import UserRole
from models.roles import Role
from schemas.teams import (
    TeamCreateRequest,
    TeamFilterRequest,
    TeamStatus,
    TeamSystemRole,
    TeamUpdateRequest,
)


# ── Helpers privados ──────────────────────────────────

def _get_user_or_404(db: Session, user_id: str) -> User:
    user = (
        db.query(User)
        .options(
            joinedload(User.profile),
            joinedload(User.roles).joinedload(UserRole.role),
        )
        .filter(User.id == user_id, User.deleted_at.is_(None))
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team member '{user_id}' no encontrado",
        )
    return user


def _check_unique_email(db: Session, email: str, exclude_id: str | None = None) -> None:
    q = db.query(User).filter(User.email == email, User.deleted_at.is_(None))
    if exclude_id:
        q = q.filter(User.id != exclude_id)
    if q.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El email '{email}' ya está registrado",
        )


def _check_unique_username(db: Session, username: str, exclude_id: str | None = None) -> None:
    q = db.query(User).filter(User.username == username, User.deleted_at.is_(None))
    if exclude_id:
        q = q.filter(User.id != exclude_id)
    if q.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El username '{username}' ya está registrado",
        )


def _get_role(db: Session, role_code: str) -> Role:
    """Obtiene el Role por código. Lanza 500 si no existe (error de configuración)."""
    role = db.query(Role).filter(Role.code == role_code, Role.is_active.is_(True)).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rol '{role_code}' no encontrado en el sistema. Verificar tabla roles.",
        )
    return role


def _get_current_role_code(user: User) -> str:
    """Extrae el código de rol activo del usuario. Retorna 'read' como fallback."""
    active_roles = [ur for ur in (user.roles or []) if ur.deleted_at is None]
    if not active_roles:
        return TeamSystemRole.read.value
    return active_roles[0].role.code if active_roles[0].role else TeamSystemRole.read.value


def _get_assignment_mode(user: User) -> str:
    """
    CORRECCIÓN: Lee assignment_mode real desde user_profiles.
    Retorna 'specific' como fallback si el perfil no existe.
    """
    profile = user.profile
    if not profile:
        return AssignmentModeEnum.specific.value
    mode = profile.assignment_mode
    if mode is None:
        return AssignmentModeEnum.specific.value
    # Soporta tanto el enum como el string
    return mode.value if hasattr(mode, "value") else str(mode)


def _build_temp_password_hash() -> str:
    """Genera un hash bcrypt de una contraseña temporal segura."""
    temp_password = secrets.token_urlsafe(16)
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(temp_password.encode(), salt).decode()


def _user_to_dict(user: User) -> dict:
    """Serializa User + UserProfile + Role al shape del frontend."""
    profile         = user.profile
    role_code       = _get_current_role_code(user)
    assignment_mode = _get_assignment_mode(user)

    return {
        "id":              user.id,
        "name":            user.full_name or "",
        "username":        user.username,
        "email":           user.email or "",
        "position":        profile.position   if profile else None,
        "phone":           user.phone,
        "department":      profile.department if profile else None,
        "status":          "active" if user.is_active else "inactive",
        "system_role":     role_code,
        "initials":        profile.initials   if profile else None,
        "color":           profile.color      if profile else None,
        "assignment_mode": assignment_mode,
        "clients":         [],   # pendiente implementación
        "projects":        [],   # pendiente implementación
        "notes":           profile.notes      if profile else None,
        "created_at":      str(user.created_at.date()) if user.created_at else "",
        "last_activity":   user.last_login_at,
    }


# ── CRUD ──────────────────────────────────────────────

def get_team_member(db: Session, user_id: str) -> dict:
    user = _get_user_or_404(db, user_id)
    return _user_to_dict(user)


def list_team_members(db: Session, filters: TeamFilterRequest) -> dict:
    q = (
        db.query(User)
        .options(
            joinedload(User.profile),
            joinedload(User.roles).joinedload(UserRole.role),
        )
        .filter(User.deleted_at.is_(None))
    )

    if filters.status:
        q = q.filter(User.is_active == (filters.status == TeamStatus.active))

    if filters.department:
        q = q.join(UserProfile, UserProfile.user_id == User.id).filter(
            UserProfile.department == filters.department.value
        )

    if filters.system_role:
        q = (
            q.join(UserRole, UserRole.user_id == User.id)
             .join(Role, Role.id == UserRole.role_id)
             .filter(Role.code == filters.system_role.value, UserRole.deleted_at.is_(None))
        )

    if filters.search:
        term = f"%{filters.search}%"
        if not filters.department:
            q = q.outerjoin(UserProfile, UserProfile.user_id == User.id)
        q = q.filter(
            or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
                User.username.ilike(term),
                UserProfile.position.ilike(term),
            )
        )

    total = q.count()
    users = q.order_by(User.full_name).offset(filters.skip).limit(filters.limit).all()

    return {
        "teams": [_user_to_dict(u) for u in users],
        "total": total,
        "skip":  filters.skip,
        "limit": filters.limit,
    }


def create_team_member(
    db: Session,
    payload: TeamCreateRequest,
    created_by_id: str | None = None,
) -> dict:
    _check_unique_email(db, str(payload.email))
    _check_unique_username(db, payload.username)

    role = _get_role(db, payload.system_role.value)
    now  = datetime.now(timezone.utc)

    # 1. Crear User
    user = User(
        id            = str(uuid.uuid4()),
        username      = payload.username,
        email         = str(payload.email),
        password_hash = _build_temp_password_hash(),
        full_name     = payload.full_name,
        phone         = payload.phone,
        is_active     = payload.status == TeamStatus.active,
        created_by    = created_by_id,
    )
    db.add(user)
    db.flush()  # obtener user.id sin commitear aún

    # 2. Crear UserProfile — CORRECCIÓN: incluye assignment_mode real
    profile = UserProfile(
        user_id         = user.id,
        position        = payload.position,
        department      = payload.department.value,
        initials        = payload.initials,
        color           = payload.color,
        notes           = payload.notes,
        assignment_mode = AssignmentModeEnum(payload.assignment_mode.value),
    )
    db.add(profile)

    # 3. Asignar rol
    user_role = UserRole(
        user_id    = user.id,
        role_id    = role.id,
        created_at = now,
        created_by = created_by_id,
    )
    db.add(user_role)

    db.commit()
    db.refresh(user)

    return _user_to_dict(_get_user_or_404(db, user.id))


def update_team_member(
    db: Session,
    user_id: str,
    payload: TeamUpdateRequest,
    updated_by_id: str | None = None,
) -> dict:
    user = _get_user_or_404(db, user_id)
    update_data = payload.model_dump(exclude_unset=True, by_alias=False)

    # ── Validaciones de unicidad ──
    if "email" in update_data and str(payload.email) != user.email:
        _check_unique_email(db, str(payload.email), exclude_id=user_id)
    if "username" in update_data and payload.username != user.username:
        _check_unique_username(db, payload.username, exclude_id=user_id)

    # ── Actualizar User ──
    user_fields = {"username", "email", "full_name", "phone"}
    for field in user_fields & update_data.keys():
        value = update_data[field]
        if field == "email":
            value = str(value)
        setattr(user, field, value)

    if "status" in update_data:
        user.is_active = update_data["status"] == TeamStatus.active.value

    user.updated_by = updated_by_id

    # ── Actualizar UserProfile ──
    profile = user.profile
    if not profile:
        profile = UserProfile(user_id=user_id)
        db.add(profile)

    profile_fields = {"position", "department", "initials", "color", "notes"}
    for field in profile_fields & update_data.keys():
        value = update_data[field]
        if hasattr(value, "value"):
            value = value.value
        setattr(profile, field, value)

    if "initials" in update_data and update_data["initials"]:
        profile.initials = update_data["initials"].upper()

    # CORRECCIÓN: assignment_mode se persiste en user_profiles
    if "assignment_mode" in update_data and update_data["assignment_mode"]:
        raw = update_data["assignment_mode"]
        profile.assignment_mode = AssignmentModeEnum(
            raw.value if hasattr(raw, "value") else raw
        )

    # ── Cambio de rol ──
    if "system_role" in update_data:
        now = datetime.now(timezone.utc)
        raw_role = update_data["system_role"]
        role_code = raw_role.value if hasattr(raw_role, "value") else raw_role
        new_role = _get_role(db, role_code)

        # soft-delete roles actuales
        for ur in (user.roles or []):
            if ur.deleted_at is None:
                ur.deleted_at = now
                ur.deleted_by = updated_by_id

        db.add(UserRole(
            user_id    = user_id,
            role_id    = new_role.id,
            created_at = now,
            created_by = updated_by_id,
        ))

    db.commit()

    return _user_to_dict(_get_user_or_404(db, user_id))


def change_team_status(
    db: Session,
    user_id: str,
    new_status: TeamStatus,
    updated_by_id: str | None = None,
) -> dict:
    user = _get_user_or_404(db, user_id)
    user.is_active  = new_status == TeamStatus.active
    user.updated_by = updated_by_id
    db.commit()
    return _user_to_dict(_get_user_or_404(db, user_id))


def delete_team_member(
    db: Session,
    user_id: str,
    deleted_by_id: str | None = None,
) -> None:
    user = _get_user_or_404(db, user_id)
    now = datetime.now(timezone.utc)

    user.deleted_at = now
    user.deleted_by = deleted_by_id
    user.is_active  = False

    db.commit()
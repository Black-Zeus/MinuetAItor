# services/teams_service.py
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

import bcrypt
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from models.user           import User
from models.user_profiles  import UserProfile, AssignmentModeEnum
from models.user_roles     import UserRole
from models.user_clients   import UserClient
from models.user_client_acl import UserClientAcl
from models.user_project_acl import UserProjectACL, UserProjectPermission
from models.roles          import Role
from schemas.teams import (
    TeamCreateRequest,
    TeamFilterRequest,
    TeamStatus,
    TeamSystemRole,
    TeamUpdateRequest,
)


# ── Helpers privados ──────────────────────────────────────────────────────────

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
    role = db.query(Role).filter(Role.code == role_code, Role.is_active.is_(True)).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rol '{role_code}' no encontrado. Verificar tabla roles.",
        )
    return role


def _get_current_role_code(user: User) -> str:
    active_roles = [ur for ur in (user.roles or []) if ur.deleted_at is None]
    if not active_roles:
        return TeamSystemRole.read.value
    return active_roles[0].role.code if active_roles[0].role else TeamSystemRole.read.value


def _get_assignment_mode(user: User) -> str:
    profile = user.profile
    if not profile:
        return AssignmentModeEnum.specific.value
    mode = profile.assignment_mode
    if mode is None:
        return AssignmentModeEnum.specific.value
    return mode.value if hasattr(mode, "value") else str(mode)


def _build_temp_password_hash() -> str:
    temp_password = secrets.token_urlsafe(16)
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(temp_password.encode(), salt).decode()


# ── Lectura de relaciones reales del usuario ──────────────────────────────────

def _get_user_client_ids(db: Session, user_id: str) -> list[str]:
    """IDs de clientes activos asignados al usuario (tabla user_clients)."""
    rows = (
        db.query(UserClient.client_id)
        .filter(
            UserClient.user_id   == user_id,
            UserClient.deleted_at.is_(None),
            UserClient.is_active == True,
        )
        .all()
    )
    return [r.client_id for r in rows]


def _get_user_project_ids(db: Session, user_id: str) -> list[str]:
    """IDs de proyectos activos asignados al usuario (tabla user_project_acl)."""
    rows = (
        db.query(UserProjectACL.project_id)
        .filter(
            UserProjectACL.user_id    == user_id,
            UserProjectACL.deleted_at.is_(None),
            UserProjectACL.is_active  == True,
        )
        .all()
    )
    return [r.project_id for r in rows]


def _user_to_dict(user: User, db: Session | None = None) -> dict:
    """
    Serializa User + UserProfile + Role al shape del frontend.
    Si se pasa db, incluye las relaciones reales de clientes y proyectos.
    """
    profile         = user.profile
    role_code       = _get_current_role_code(user)
    assignment_mode = _get_assignment_mode(user)

    clients  = []
    projects = []
    if db is not None:
        clients  = _get_user_client_ids(db, user.id)
        projects = _get_user_project_ids(db, user.id)

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
        "clients":         clients,
        "projects":        projects,
        "notes":           profile.notes      if profile else None,
        "created_at":      str(user.created_at.date()) if user.created_at else "",
        "last_activity":   user.last_login_at if hasattr(user, "last_login_at") else None,
    }


# ── Sync de relaciones user↔client ───────────────────────────────────────────
#
# Estrategia DIFF:
#   1. Obtener IDs actuales activos en la tabla.
#   2. IDs que ya no están en el nuevo set → soft-delete (deleted_at, is_active=False).
#   3. IDs nuevos que no existían → INSERT.
#   4. IDs que ya existían pero estaban soft-deleted → reactivar.
#
# NUNCA borramos físicamente ni hacemos DELETE+INSERT masivo.

def _sync_user_clients(
    db: Session,
    user_id: str,
    new_client_ids: list[str],
    updated_by_id: str | None,
    now: datetime,
) -> None:
    """Sincroniza user_clients con el nuevo set de IDs."""
    new_set = set(new_client_ids)

    # Obtener todos los registros (activos e inactivos, sin physically deleted)
    existing: list[UserClient] = (
        db.query(UserClient)
        .filter(UserClient.user_id == user_id)
        .all()
    )
    existing_map = {r.client_id: r for r in existing}
    existing_active_set = {r.client_id for r in existing if r.deleted_at is None and r.is_active}

    # Soft-delete los que ya no van
    to_remove = existing_active_set - new_set
    for client_id in to_remove:
        rec = existing_map[client_id]
        rec.deleted_at = now
        rec.deleted_by = updated_by_id
        rec.is_active  = False
        rec.updated_at = now
        rec.updated_by = updated_by_id

    # Agregar o reactivar los nuevos
    to_add = new_set - existing_active_set
    for client_id in to_add:
        if client_id in existing_map:
            # Existía pero estaba inactivo/eliminado → reactivar
            rec = existing_map[client_id]
            rec.deleted_at = None
            rec.deleted_by = None
            rec.is_active  = True
            rec.updated_at = now
            rec.updated_by = updated_by_id
        else:
            # Nuevo registro
            db.add(UserClient(
                user_id    = user_id,
                client_id  = client_id,
                is_active  = True,
                created_at = now,
                created_by = updated_by_id,
            ))


def _sync_user_projects(
    db: Session,
    user_id: str,
    new_project_ids: list[str],
    updated_by_id: str | None,
    now: datetime,
) -> None:
    """Sincroniza user_project_acl con el nuevo set de IDs."""
    new_set = set(new_project_ids)

    existing: list[UserProjectACL] = (
        db.query(UserProjectACL)
        .filter(UserProjectACL.user_id == user_id)
        .all()
    )
    existing_map = {r.project_id: r for r in existing}
    existing_active_set = {r.project_id for r in existing if r.deleted_at is None and r.is_active}

    # Soft-delete los que ya no van
    to_remove = existing_active_set - new_set
    for project_id in to_remove:
        rec = existing_map[project_id]
        rec.deleted_at = now
        rec.deleted_by = updated_by_id
        rec.is_active  = False
        rec.updated_by = updated_by_id

    # Agregar o reactivar los nuevos
    to_add = new_set - existing_active_set
    for project_id in to_add:
        if project_id in existing_map:
            rec = existing_map[project_id]
            rec.deleted_at = None
            rec.deleted_by = None
            rec.is_active  = True
            rec.updated_by = updated_by_id
        else:
            db.add(UserProjectACL(
                user_id    = user_id,
                project_id = project_id,
                permission = UserProjectPermission.read,  # permiso base por defecto
                is_active  = True,
                created_by = updated_by_id,
            ))


# ── CRUD ──────────────────────────────────────────────────────────────────────

def get_team_member(db: Session, user_id: str) -> dict:
    user = _get_user_or_404(db, user_id)
    return _user_to_dict(user, db=db)


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

    # NOTA: en el listado NO incluimos relaciones (es costoso para N usuarios).
    # El detalle completo se obtiene con get_team_member().
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

    # 1. User
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
    db.flush()

    # 2. UserProfile
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

    # 3. Rol
    db.add(UserRole(
        user_id    = user.id,
        role_id    = role.id,
        created_at = now,
        created_by = created_by_id,
    ))

    # 4. Relaciones clientes/proyectos (si assignmentMode = specific)
    #    Si es "all" no hace falta guardar relaciones — el flag en el profile lo indica.
    if payload.assignment_mode.value == "specific":
        _sync_user_clients(db, user.id, list(payload.clients or []), created_by_id, now)
        _sync_user_projects(db, user.id, list(payload.projects or []), created_by_id, now)

    db.commit()
    db.refresh(user)
    return _user_to_dict(_get_user_or_404(db, user.id), db=db)


def update_team_member(
    db: Session,
    user_id: str,
    payload: TeamUpdateRequest,
    updated_by_id: str | None = None,
) -> dict:
    user = _get_user_or_404(db, user_id)
    update_data = payload.model_dump(exclude_unset=True, by_alias=False)
    now = datetime.now(timezone.utc)

    # ── Validaciones de unicidad ──────────────────────────────────────────────
    if "email" in update_data and str(payload.email) != user.email:
        _check_unique_email(db, str(payload.email), exclude_id=user_id)
    if "username" in update_data and payload.username != user.username:
        _check_unique_username(db, payload.username, exclude_id=user_id)

    # ── Actualizar User ───────────────────────────────────────────────────────
    user_fields = {"username", "email", "full_name", "phone"}
    for field in user_fields & update_data.keys():
        value = update_data[field]
        if field == "email":
            value = str(value)
        setattr(user, field, value)

    if "status" in update_data:
        user.is_active = update_data["status"] == TeamStatus.active.value

    user.updated_by = updated_by_id

    # ── Actualizar UserProfile ────────────────────────────────────────────────
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

    # CORRECCIÓN: assignment_mode persistido en user_profiles
    new_assignment_mode: str | None = None
    if "assignment_mode" in update_data and update_data["assignment_mode"]:
        raw = update_data["assignment_mode"]
        new_assignment_mode = raw.value if hasattr(raw, "value") else str(raw)
        profile.assignment_mode = AssignmentModeEnum(new_assignment_mode)

    # ── Cambio de rol ─────────────────────────────────────────────────────────
    if "system_role" in update_data:
        raw_role  = update_data["system_role"]
        role_code = raw_role.value if hasattr(raw_role, "value") else raw_role
        new_role  = _get_role(db, role_code)

        # Soft-delete todos los roles activos
        for ur in (user.roles or []):
            if ur.deleted_at is None:
                ur.deleted_at = now
                ur.deleted_by = updated_by_id

        db.flush()  # <-- forzar el UPDATE antes del INSERT

        # Verificar si ya existe un registro (soft-deleted) para ese rol
        existing_role = (
            db.query(UserRole)
            .filter(
                UserRole.user_id == user_id,
                UserRole.role_id == new_role.id,
            )
            .first()
        )

        if existing_role:
            # Reactivar el registro existente (evita duplicate PK)
            existing_role.deleted_at = None
            existing_role.deleted_by = None
            existing_role.created_at = now
            existing_role.created_by = updated_by_id
        else:
            db.add(UserRole(
                user_id    = user_id,
                role_id    = new_role.id,
                created_at = now,
                created_by = updated_by_id,
            ))

    # ── Sync de relaciones cliente/proyecto ───────────────────────────────────
    #
    # Respuesta a pregunta 3.1:
    #   assignmentMode = "all"  → limpiar todas las relaciones específicas.
    #     El acceso total se controla por el flag en user_profiles, no por registros
    #     en user_clients/user_project_acl. Guardar relaciones en ese caso sería
    #     confuso y generaría datos redundantes.
    #
    # Respuesta a pregunta 3.2:
    #   assignmentMode = "specific" → DIFF sync (no borrar todo y recrear).
    #     Se preservan los permisos (permission) de los proyectos que ya existían.
    #     Solo se eliminan los que ya no están y se agregan los faltantes.
    #
    # CUÁNDO sincronizar:
    #   Siempre que el payload incluya "clients" o "projects" (exclude_unset los filtra).
    #   Si no vienen en el payload, no tocamos las relaciones.

    effective_mode = new_assignment_mode or _get_assignment_mode(user)

    if effective_mode == "all":
        # Acceso total: limpiar relaciones específicas
        if "clients" in update_data or "assignment_mode" in update_data:
            _sync_user_clients(db, user_id, [], updated_by_id, now)
        if "projects" in update_data or "assignment_mode" in update_data:
            _sync_user_projects(db, user_id, [], updated_by_id, now)
    else:
        # Acceso específico: sync solo si el payload trae los campos
        if "clients" in update_data:
            new_clients = [str(c) for c in (update_data["clients"] or [])]
            _sync_user_clients(db, user_id, new_clients, updated_by_id, now)
        if "projects" in update_data:
            new_projects = [str(p) for p in (update_data["projects"] or [])]
            _sync_user_projects(db, user_id, new_projects, updated_by_id, now)

    db.commit()
    return _user_to_dict(_get_user_or_404(db, user_id), db=db)


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
    return _user_to_dict(_get_user_or_404(db, user_id), db=db)


def delete_team_member(
    db: Session,
    user_id: str,
    deleted_by_id: str | None = None,
) -> None:
    user = _get_user_or_404(db, user_id)
    now = datetime.now(timezone.utc)

    # Soft-delete también las relaciones del usuario
    _sync_user_clients(db, user_id, [], deleted_by_id, now)
    _sync_user_projects(db, user_id, [], deleted_by_id, now)

    user.deleted_at = now
    user.deleted_by = deleted_by_id
    user.is_active  = False

    db.commit()
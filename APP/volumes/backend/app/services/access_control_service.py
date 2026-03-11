from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.authz import has_any_permission, has_role
from core.exceptions import ForbiddenException
from models.projects import Project
from models.user_client_acl import UserClientAcl
from models.user_clients import UserClient
from models.user_profiles import AssignmentModeEnum, UserProfile
from models.user_project_acl import UserProjectACL
from schemas.auth import UserSession


def is_admin(session: UserSession) -> bool:
    return has_role(session, "ADMIN")


def can_manage_clients(session: UserSession) -> bool:
    return is_admin(session) or has_any_permission(session, {"clients.manage", "users.manage"})


def can_manage_projects(session: UserSession) -> bool:
    return is_admin(session) or has_any_permission(session, {"clients.manage"})


def _get_assignment_mode(db: Session, user_id: str) -> str:
    profile = (
        db.query(UserProfile)
        .filter(UserProfile.user_id == user_id)
        .first()
    )
    if not profile or not profile.assignment_mode:
        return AssignmentModeEnum.specific.value

    mode = profile.assignment_mode
    return mode.value if hasattr(mode, "value") else str(mode)


def can_access_all_clients(db: Session, session: UserSession) -> bool:
    if is_admin(session):
        return True
    return _get_assignment_mode(db, session.user_id) == AssignmentModeEnum.all.value


def get_accessible_client_ids(db: Session, session: UserSession) -> list[str]:
    if can_access_all_clients(db, session):
        return []

    user_id = session.user_id
    rows = (
        db.query(UserClient.client_id)
        .filter(
            UserClient.user_id == user_id,
            UserClient.deleted_at.is_(None),
            UserClient.is_active.is_(True),
        )
        .union(
            db.query(UserClientAcl.client_id).filter(
                UserClientAcl.user_id == user_id,
                UserClientAcl.deleted_at.is_(None),
                UserClientAcl.is_active.is_(True),
            )
        )
        .all()
    )
    return [row[0] if isinstance(row, tuple) else row.client_id for row in rows]


def ensure_client_read_access(db: Session, session: UserSession, client_id: str) -> None:
    if can_access_all_clients(db, session):
        return

    accessible_ids = set(get_accessible_client_ids(db, session))
    if client_id not in accessible_ids:
        raise ForbiddenException("No tienes acceso a este cliente")


def apply_client_scope_filter(query, db: Session, session: UserSession, client_id_column):
    if can_access_all_clients(db, session):
        return query

    accessible_ids = get_accessible_client_ids(db, session)
    if not accessible_ids:
        return query.filter(False)
    return query.filter(client_id_column.in_(accessible_ids))


def ensure_project_read_access(db: Session, session: UserSession, project_id: str) -> None:
    if can_access_all_clients(db, session):
        return

    user_id = session.user_id
    exists = (
        db.query(Project.id)
        .outerjoin(
            UserProjectACL,
            (UserProjectACL.project_id == Project.id)
            & (UserProjectACL.user_id == user_id)
            & (UserProjectACL.deleted_at.is_(None))
            & (UserProjectACL.is_active.is_(True)),
        )
        .outerjoin(
            UserClient,
            (UserClient.client_id == Project.client_id)
            & (UserClient.user_id == user_id)
            & (UserClient.deleted_at.is_(None))
            & (UserClient.is_active.is_(True)),
        )
        .outerjoin(
            UserClientAcl,
            (UserClientAcl.client_id == Project.client_id)
            & (UserClientAcl.user_id == user_id)
            & (UserClientAcl.deleted_at.is_(None))
            & (UserClientAcl.is_active.is_(True)),
        )
        .filter(
            Project.id == project_id,
            Project.deleted_at.is_(None),
            or_(
                UserProjectACL.project_id.isnot(None),
                UserClient.client_id.isnot(None),
                UserClientAcl.client_id.isnot(None),
            ),
        )
        .first()
    )
    if not exists:
        raise ForbiddenException("No tienes acceso a este proyecto")


def apply_project_scope_filter(query, db: Session, session: UserSession, project_model=Project):
    if can_access_all_clients(db, session):
        return query

    user_id = session.user_id
    return (
        query.outerjoin(
            UserProjectACL,
            (UserProjectACL.project_id == project_model.id)
            & (UserProjectACL.user_id == user_id)
            & (UserProjectACL.deleted_at.is_(None))
            & (UserProjectACL.is_active.is_(True)),
        )
        .outerjoin(
            UserClient,
            (UserClient.client_id == project_model.client_id)
            & (UserClient.user_id == user_id)
            & (UserClient.deleted_at.is_(None))
            & (UserClient.is_active.is_(True)),
        )
        .outerjoin(
            UserClientAcl,
            (UserClientAcl.client_id == project_model.client_id)
            & (UserClientAcl.user_id == user_id)
            & (UserClientAcl.deleted_at.is_(None))
            & (UserClientAcl.is_active.is_(True)),
        )
        .filter(
            or_(
                UserProjectACL.project_id.isnot(None),
                UserClient.client_id.isnot(None),
                UserClientAcl.client_id.isnot(None),
            )
        )
        .distinct()
    )

# services/projects_service.py
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from core.datetime_utils import utc_now_db
from core.exceptions import ConflictException, ForbiddenException
from models.records import Record
from models.projects import Project
from schemas.auth import UserSession
from schemas.projects import ProjectCreateRequest, ProjectFilterRequest, ProjectUpdateRequest
from services.access_control_service import (
    apply_project_scope_filter,
    can_manage_projects,
    ensure_client_read_access,
    ensure_project_read_access,
)
from services.project_logo_service import (
    get_project_logo_url_if_exists,
    read_project_logo,
    remove_project_logo,
    save_project_logo,
)
from services.pdf_template_resolver import resolve_pdf_template_for_project


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: Project) -> dict:
    return {
        "id": str(obj.id),
        "client_id": str(obj.client_id),
        "client_name": getattr(obj.client, "name", None),   # ← NUEVO
        "logo_url": get_project_logo_url_if_exists(obj),
        "name": obj.name,
        "code": obj.code,
        "description": obj.description,
        "notes": obj.notes,
        "tags": obj.tags,
        # "status": obj.status,   ← ELIMINADO (redundante con is_active)
        "is_confidential": bool(obj.is_confidential),
        "is_active": bool(obj.is_active),
        "auto_send_on_preview": bool(getattr(obj, "auto_send_on_preview", False)),
        "auto_send_on_completed": bool(getattr(obj, "auto_send_on_completed", False)),
        "pdf_template_override": getattr(obj, "pdf_template_override", None),
        "resolved_pdf_template": resolve_pdf_template_for_project(obj),
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        "created_by": _user_ref(getattr(obj, "created_by_user", None)),
        "updated_by": _user_ref(getattr(obj, "updated_by_user", None)),
        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deleted_by": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, project_id: str) -> Project:
    obj = (
        db.query(Project)
        .options(
            joinedload(Project.client),
            joinedload(Project.avatar_object),
            joinedload(Project.created_by_user),
            joinedload(Project.updated_by_user),
            joinedload(Project.deleted_by_user),
        )
        .filter(Project.id == project_id, Project.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_client_name(db: Session, client_id: str, name: str, exclude_id: str | None = None) -> None:
    q = db.query(Project).filter(
        Project.deleted_at.is_(None),
        Project.client_id == client_id,
        Project.name == name,
    )
    if exclude_id:
        q = q.filter(Project.id != exclude_id)

    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="CLIENT_NAME_ALREADY_EXISTS")


def _check_unique_code(db: Session, code: str | None, exclude_id: str | None = None) -> None:
    if code is None:
        return

    q = db.query(Project).filter(Project.deleted_at.is_(None), Project.code == code)
    if exclude_id:
        q = q.filter(Project.id != exclude_id)

    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="CODE_ALREADY_EXISTS")


def get_project(db: Session, project_id: str, session: UserSession) -> dict:
    ensure_project_read_access(db, session, project_id)
    obj = _get_or_404(db, project_id)
    return _build_response_dict(obj)


def list_projects(db: Session, filters: ProjectFilterRequest, session: UserSession) -> dict:
    q = db.query(Project).filter(Project.deleted_at.is_(None))
    q = apply_project_scope_filter(q, db, session, Project)

    if filters.client_id:
        q = q.filter(Project.client_id == filters.client_id)

    if filters.is_active is not None:
        q = q.filter(Project.is_active.is_(bool(filters.is_active)))

    if filters.status:
        q = q.filter(Project.status == filters.status)

    if filters.is_confidential is not None:
        q = q.filter(Project.is_confidential.is_(bool(filters.is_confidential)))

    if filters.q:
        like = f"%{filters.q.strip()}%"
        q = q.filter(or_(Project.name.ilike(like), Project.code.ilike(like), Project.tags.ilike(like)))

    total = q.with_entities(func.count(Project.id)).scalar() or 0

    items = (
        q.options(
            joinedload(Project.client),
            joinedload(Project.avatar_object),
            joinedload(Project.created_by_user),
            joinedload(Project.updated_by_user),
            joinedload(Project.deleted_by_user),
        )
        .order_by(Project.created_at.desc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(x) for x in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def create_project(
    db: Session,
    body: ProjectCreateRequest,
    created_by_id: str,
    session: UserSession,
) -> dict:
    if not can_manage_projects(session):
        raise ForbiddenException("No tienes permisos para crear proyectos")

    ensure_client_read_access(db, session, body.client_id)
    # Verificar unicidad nombre+cliente antes de crear
    _check_unique_client_name(db, body.client_id, body.name, exclude_id=None)

    # El código siempre se genera en el backend — nunca viene del cliente
    generated_code = str(uuid.uuid4())

    obj = Project(
        id=str(uuid.uuid4()),
        client_id=body.client_id,
        name=body.name,
        code=generated_code,
        description=body.description,
        notes=body.notes,
        tags=body.tags,
        status=body.status,
        is_confidential=bool(body.is_confidential),
        is_active=bool(body.is_active),
        auto_send_on_preview=bool(body.auto_send_on_preview),
        auto_send_on_completed=bool(body.auto_send_on_completed),
        pdf_template_override=body.pdf_template_override,
        created_by=created_by_id,
        updated_by=None,
        deleted_at=None,
        deleted_by=None,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_project(
    db: Session,
    project_id: str,
    body: ProjectUpdateRequest,
    updated_by_id: str,
    session: UserSession,
) -> dict:
    if not can_manage_projects(session):
        raise ForbiddenException("No tienes permisos para editar proyectos")

    ensure_project_read_access(db, session, project_id)
    obj = _get_or_404(db, project_id)

    next_client_id = body.client_id if body.client_id is not None else obj.client_id
    next_name = body.name if body.name is not None else obj.name
    _check_unique_client_name(db, next_client_id, next_name, exclude_id=obj.id)

    # En update sí se permite cambiar el code (viene del body)
    next_code = body.code if body.code is not None else obj.code
    _check_unique_code(db, next_code, exclude_id=obj.id)

    if body.client_id is not None:
        obj.client_id = body.client_id
    if body.name is not None:
        obj.name = body.name
    if body.code is not None:
        obj.code = body.code
    if body.description is not None:
        obj.description = body.description
    if body.notes is not None:
        obj.notes = body.notes
    if body.tags is not None:
        obj.tags = body.tags
    if body.status is not None:
        obj.status = body.status
    if body.is_confidential is not None:
        obj.is_confidential = bool(body.is_confidential)
    if body.is_active is not None:
        obj.is_active = bool(body.is_active)
    if body.auto_send_on_preview is not None:
        obj.auto_send_on_preview = bool(body.auto_send_on_preview)
    if body.auto_send_on_completed is not None:
        obj.auto_send_on_completed = bool(body.auto_send_on_completed)
    if "pdf_template_override" in body.model_fields_set:
        obj.pdf_template_override = body.pdf_template_override

    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def change_project_status(
    db: Session,
    project_id: str,
    is_active: bool,
    updated_by_id: str,
    session: UserSession,
) -> dict:
    if not can_manage_projects(session):
        raise ForbiddenException("No tienes permisos para cambiar el estado de proyectos")

    ensure_project_read_access(db, session, project_id)
    obj = _get_or_404(db, project_id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_project(db: Session, project_id: str, deleted_by_id: str, session: UserSession) -> None:
    if not can_manage_projects(session):
        raise ForbiddenException("No tienes permisos para eliminar proyectos")

    ensure_project_read_access(db, session, project_id)
    obj = _get_or_404(db, project_id)
    has_minutes = (
        db.query(Record.id)
        .filter(Record.project_id == project_id, Record.deleted_at.is_(None))
        .first()
        is not None
    )
    if has_minutes:
        raise ConflictException("No se puede eliminar el proyecto porque posee minutas asociadas.")

    obj.deleted_at = utc_now_db()
    obj.deleted_by = deleted_by_id
    obj.is_active = False

    db.commit()


async def upload_project_logo(
    db: Session,
    project_id: str,
    file: UploadFile,
    session: UserSession,
) -> dict:
    if not can_manage_projects(session):
        raise ForbiddenException("No tienes permisos para editar proyectos")

    ensure_project_read_access(db, session, project_id)
    obj = _get_or_404(db, project_id)
    logo_url = await save_project_logo(db, obj, file, actor_user_id=session.user_id)
    return {"logo_url": logo_url}


def delete_project_logo(
    db: Session,
    project_id: str,
    session: UserSession,
) -> dict:
    if not can_manage_projects(session):
        raise ForbiddenException("No tienes permisos para editar proyectos")

    ensure_project_read_access(db, session, project_id)
    obj = _get_or_404(db, project_id)
    remove_project_logo(db, obj, actor_user_id=session.user_id)
    return {"logo_url": None}


def read_project_logo_content(db: Session, project_id: str) -> tuple[bytes, str]:
    obj = _get_or_404(db, project_id)
    return read_project_logo(db, obj)

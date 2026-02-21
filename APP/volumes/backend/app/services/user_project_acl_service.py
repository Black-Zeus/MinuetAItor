# services/user_project_acl_service.py

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from models.user_project_acl import UserProjectACL, UserProjectPermission
from schemas.user_project_acl import (
    UserProjectACLCreateRequest,
    UserProjectACLFilterRequest,
    UserProjectACLUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: UserProjectACL) -> dict[str, Any]:
    return {
        "userId": str(obj.user_id),
        "projectId": str(obj.project_id),
        "permission": obj.permission.value if isinstance(obj.permission, UserProjectPermission) else str(obj.permission),
        "isActive": bool(obj.is_active),
        "createdAt": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updatedAt": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,
        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "updatedBy": _user_ref(getattr(obj, "updated_by_user", None)),
        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, user_id: str, project_id: str) -> UserProjectACL:
    q = (
        db.query(UserProjectACL)
        .options(
            joinedload(UserProjectACL.user),
            joinedload(UserProjectACL.project),
            joinedload(UserProjectACL.created_by_user),
            joinedload(UserProjectACL.updated_by_user),
            joinedload(UserProjectACL.deleted_by_user),
        )
        .filter(
            UserProjectACL.user_id == user_id,
            UserProjectACL.project_id == project_id,
            UserProjectACL.deleted_at.is_(None),
        )
    )
    obj = q.first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def get_user_project_acl(db: Session, user_id: str, project_id: str) -> dict[str, Any]:
    obj = _get_or_404(db, user_id, project_id)
    return _build_response_dict(obj)


def list_user_project_acls(db: Session, filters: UserProjectACLFilterRequest) -> dict[str, Any]:
    q = db.query(UserProjectACL).filter(UserProjectACL.deleted_at.is_(None))

    if filters.user_id:
        q = q.filter(UserProjectACL.user_id == filters.user_id)
    if filters.project_id:
        q = q.filter(UserProjectACL.project_id == filters.project_id)
    if filters.permission:
        q = q.filter(UserProjectACL.permission == UserProjectPermission(filters.permission.value))
    if filters.is_active is not None:
        q = q.filter(UserProjectACL.is_active.is_(bool(filters.is_active)))

    total = q.with_entities(func.count(UserProjectACL.user_id)).scalar() or 0

    items = (
        q.options(
            joinedload(UserProjectACL.user),
            joinedload(UserProjectACL.project),
            joinedload(UserProjectACL.created_by_user),
            joinedload(UserProjectACL.updated_by_user),
            joinedload(UserProjectACL.deleted_by_user),
        )
        .order_by(UserProjectACL.user_id.asc(), UserProjectACL.project_id.asc())
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


def create_user_project_acl(db: Session, body: UserProjectACLCreateRequest, created_by_id: str) -> dict[str, Any]:
    # Evitar duplicado de PK compuesta (solo sobre no-deleted)
    exists = (
        db.query(UserProjectACL)
        .filter(
            UserProjectACL.user_id == body.user_id,
            UserProjectACL.project_id == body.project_id,
            UserProjectACL.deleted_at.is_(None),
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="ACL_ALREADY_EXISTS")

    obj = UserProjectACL(
        user_id=body.user_id,
        project_id=body.project_id,
        permission=UserProjectPermission(body.permission.value),
        is_active=bool(body.is_active),
        created_by=created_by_id,
        updated_by=None,
        deleted_at=None,
        deleted_by=None,
    )

    db.add(obj)
    db.commit()
    # refresco + reload hydratado
    db.refresh(obj)
    obj = _get_or_404(db, obj.user_id, obj.project_id)
    return _build_response_dict(obj)


def update_user_project_acl(
    db: Session,
    user_id: str,
    project_id: str,
    body: UserProjectACLUpdateRequest,
    updated_by_id: str,
) -> dict[str, Any]:
    obj = _get_or_404(db, user_id, project_id)

    if body.permission is not None:
        obj.permission = UserProjectPermission(body.permission.value)
    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)
    obj = _get_or_404(db, obj.user_id, obj.project_id)
    return _build_response_dict(obj)


def change_user_project_acl_status(
    db: Session,
    user_id: str,
    project_id: str,
    is_active: bool,
    updated_by_id: str,
) -> dict[str, Any]:
    obj = _get_or_404(db, user_id, project_id)
    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)
    obj = _get_or_404(db, obj.user_id, obj.project_id)
    return _build_response_dict(obj)


def delete_user_project_acl(db: Session, user_id: str, project_id: str, deleted_by_id: str) -> None:
    obj = _get_or_404(db, user_id, project_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False
    obj.updated_by = deleted_by_id

    db.commit()
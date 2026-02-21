# services/user_client_acl_service.py
from __future__ import annotations

from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from models.user_client_acl import UserClientAcl
from schemas.user_client_acl import (
    UserClientAclCreateRequest,
    UserClientAclFilterRequest,
    UserClientAclUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _get_or_404(db: Session, user_id: str, client_id: str) -> UserClientAcl:
    obj = (
        db.query(UserClientAcl)
        .options(
            joinedload(UserClientAcl.user),
            joinedload(UserClientAcl.client),
            joinedload(UserClientAcl.created_by_user),
            joinedload(UserClientAcl.updated_by_user),
            joinedload(UserClientAcl.deleted_by_user),
        )
        .filter(
            UserClientAcl.user_id == user_id,
            UserClientAcl.client_id == client_id,
            UserClientAcl.deleted_at.is_(None),
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _build_response_dict(obj: UserClientAcl) -> dict:
    return {
        "userId": str(obj.user_id),
        "clientId": str(obj.client_id),
        "permission": obj.permission.value if hasattr(obj.permission, "value") else str(obj.permission),
        "isActive": bool(obj.is_active),
        "createdAt": obj.created_at,
        "updatedAt": obj.updated_at,
        "deletedAt": obj.deleted_at,
        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "updatedBy": _user_ref(getattr(obj, "updated_by_user", None)),
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def get_user_client_acl(db: Session, user_id: str, client_id: str) -> dict:
    obj = _get_or_404(db, user_id, client_id)
    return _build_response_dict(obj)


def list_user_client_acls(db: Session, filters: UserClientAclFilterRequest) -> dict:
    q = db.query(UserClientAcl).filter(UserClientAcl.deleted_at.is_(None))

    if filters.user_id:
        q = q.filter(UserClientAcl.user_id == filters.user_id)
    if filters.client_id:
        q = q.filter(UserClientAcl.client_id == filters.client_id)
    if filters.permission:
        q = q.filter(UserClientAcl.permission == filters.permission.value)
    if filters.is_active is not None:
        q = q.filter(UserClientAcl.is_active.is_(bool(filters.is_active)))

    total = q.with_entities(func.count()).scalar() or 0

    items = (
        q.options(
            joinedload(UserClientAcl.user),
            joinedload(UserClientAcl.client),
            joinedload(UserClientAcl.created_by_user),
            joinedload(UserClientAcl.updated_by_user),
            joinedload(UserClientAcl.deleted_by_user),
        )
        .order_by(UserClientAcl.created_at.desc())
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


def create_user_client_acl(db: Session, body: UserClientAclCreateRequest, created_by_id: str) -> dict:
    existing = (
        db.query(UserClientAcl)
        .filter(
            UserClientAcl.user_id == body.user_id,
            UserClientAcl.client_id == body.client_id,
            UserClientAcl.deleted_at.is_(None),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="ACL_ALREADY_EXISTS")

    obj = UserClientAcl(
        user_id=body.user_id,
        client_id=body.client_id,
        permission=body.permission.value,
        is_active=bool(body.is_active),
        created_by=created_by_id,
    )

    db.add(obj)
    db.commit()

    obj = _get_or_404(db, obj.user_id, obj.client_id)
    return _build_response_dict(obj)


def update_user_client_acl(
    db: Session,
    user_id: str,
    client_id: str,
    body: UserClientAclUpdateRequest,
    updated_by_id: str,
) -> dict:
    obj = _get_or_404(db, user_id, client_id)

    if body.permission is not None:
        obj.permission = body.permission.value
    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id
    obj.updated_at = datetime.utcnow()

    db.commit()

    obj = _get_or_404(db, user_id, client_id)
    return _build_response_dict(obj)


def change_user_client_acl_status(
    db: Session,
    user_id: str,
    client_id: str,
    is_active: bool,
    updated_by_id: str,
) -> dict:
    obj = _get_or_404(db, user_id, client_id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id
    obj.updated_at = datetime.utcnow()

    db.commit()

    obj = _get_or_404(db, user_id, client_id)
    return _build_response_dict(obj)


def delete_user_client_acl(db: Session, user_id: str, client_id: str, deleted_by_id: str) -> None:
    obj = _get_or_404(db, user_id, client_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False
    obj.updated_at = datetime.utcnow()
    obj.updated_by = deleted_by_id

    db.commit()
    return None
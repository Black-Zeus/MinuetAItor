# services/permissions_service.py
from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from models.permissions import Permission
from schemas.permissions import (
    PermissionCreateRequest,
    PermissionFilterRequest,
    PermissionUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: Permission) -> dict:
    return {
        "id": int(obj.id),
        "code": obj.code,
        "name": obj.name,
        "description": obj.description,
        "is_active": bool(obj.is_active),
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        "created_by": _user_ref(getattr(obj, "created_by_user", None)),
        "updated_by": _user_ref(getattr(obj, "updated_by_user", None)),
        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deleted_by": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, id: int) -> Permission:
    obj = (
        db.query(Permission)
        .options(
            joinedload(Permission.created_by_user),
            joinedload(Permission.updated_by_user),
            joinedload(Permission.deleted_by_user),
        )
        .filter(Permission.id == id, Permission.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_code(db: Session, code: str, exclude_id: int | None = None) -> None:
    q = db.query(Permission).filter(Permission.code == code, Permission.deleted_at.is_(None))
    if exclude_id is not None:
        q = q.filter(Permission.id != exclude_id)
    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="CODE_ALREADY_EXISTS")


def get_permission(db: Session, id: int) -> dict:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_permissions(db: Session, filters: PermissionFilterRequest) -> dict:
    q = db.query(Permission).filter(Permission.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(Permission.is_active.is_(bool(filters.is_active)))

    if filters.q:
        like = f"%{filters.q.strip()}%"
        q = q.filter(or_(Permission.code.like(like), Permission.name.like(like)))

    total = q.with_entities(func.count(Permission.id)).scalar() or 0

    items = (
        q.options(
            joinedload(Permission.created_by_user),
            joinedload(Permission.updated_by_user),
            joinedload(Permission.deleted_by_user),
        )
        .order_by(Permission.id.desc())
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


def create_permission(db: Session, body: PermissionCreateRequest, created_by_id: str) -> dict:
    _check_unique_code(db, body.code)

    obj = Permission(
        code=body.code,
        name=body.name,
        description=body.description,
        is_active=bool(body.is_active),
        created_by=created_by_id,
        updated_by=created_by_id,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_permission(db: Session, id: int, body: PermissionUpdateRequest, updated_by_id: str) -> dict:
    obj = _get_or_404(db, id)

    if body.code is not None and body.code != obj.code:
        _check_unique_code(db, body.code, exclude_id=id)
        obj.code = body.code

    if body.name is not None:
        obj.name = body.name

    if body.description is not None:
        obj.description = body.description

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def change_permission_status(db: Session, id: int, is_active: bool, updated_by_id: str) -> dict:
    obj = _get_or_404(db, id)
    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_permission(db: Session, id: int, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)
    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False
    obj.updated_by = deleted_by_id

    db.commit()
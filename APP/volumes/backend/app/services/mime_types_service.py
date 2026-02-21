# services/mime_types_service.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from models.mime_types import MimeType


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: MimeType) -> dict[str, Any]:
    return {
        "id": int(obj.id),
        "mime": obj.mime,
        "description": obj.description,
        "isActive": bool(obj.is_active),
        "createdAt": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updatedAt": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,
        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "updatedBy": _user_ref(getattr(obj, "updated_by_user", None)),
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, id: int) -> MimeType:
    obj = (
        db.query(MimeType)
        .options(
            joinedload(MimeType.created_by_user),
            joinedload(MimeType.updated_by_user),
            joinedload(MimeType.deleted_by_user),
        )
        .filter(MimeType.id == id, MimeType.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_mime(db: Session, mime: str, exclude_id: int | None = None) -> None:
    q = db.query(MimeType).filter(MimeType.mime == mime, MimeType.deleted_at.is_(None))
    if exclude_id is not None:
        q = q.filter(MimeType.id != exclude_id)
    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="MIME_ALREADY_EXISTS")


def get_mime_type(db: Session, id: int) -> dict:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_mime_types(db: Session, filters) -> dict:
    q = db.query(MimeType).filter(MimeType.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(MimeType.is_active.is_(bool(filters.is_active)))

    if getattr(filters, "mime", None):
        q = q.filter(MimeType.mime == filters.mime)

    if getattr(filters, "q", None):
        like = f"%{filters.q}%"
        q = q.filter(or_(MimeType.mime.like(like), MimeType.description.like(like)))

    total = q.with_entities(func.count(MimeType.id)).scalar() or 0

    items = (
        q.options(
            joinedload(MimeType.created_by_user),
            joinedload(MimeType.updated_by_user),
            joinedload(MimeType.deleted_by_user),
        )
        .order_by(MimeType.id.asc())
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


def create_mime_type(db: Session, body, created_by_id: str) -> dict:
    _check_unique_mime(db, body.mime, exclude_id=None)

    obj = MimeType(
        mime=body.mime,
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


def update_mime_type(db: Session, id: int, body, updated_by_id: str) -> dict:
    obj = _get_or_404(db, id)

    if body.mime is not None and body.mime != obj.mime:
        _check_unique_mime(db, body.mime, exclude_id=obj.id)
        obj.mime = body.mime

    if body.description is not None:
        obj.description = body.description

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def change_mime_type_status(db: Session, id: int, is_active: bool, updated_by_id: str) -> dict:
    obj = _get_or_404(db, id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_mime_type(db: Session, id: int, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False
    obj.updated_by = deleted_by_id

    db.add(obj)
    db.commit()
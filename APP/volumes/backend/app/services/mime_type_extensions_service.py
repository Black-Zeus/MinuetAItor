# services/mime_type_extensions_service.py

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.mime_type_extensions import MimeTypeExtension
from schemas.mime_type_extensions import (
    MimeTypeExtensionCreateRequest,
    MimeTypeExtensionFilterRequest,
    MimeTypeExtensionUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _get_or_404(db: Session, mime_type_id: int, file_extension_id: int) -> MimeTypeExtension:
    obj = (
        db.query(MimeTypeExtension)
        .options(
            joinedload(MimeTypeExtension.mime_type),
            joinedload(MimeTypeExtension.file_extension),
            joinedload(MimeTypeExtension.created_by_user),
            joinedload(MimeTypeExtension.updated_by_user),
            joinedload(MimeTypeExtension.deleted_by_user),
        )
        .filter(
            MimeTypeExtension.mime_type_id == mime_type_id,
            MimeTypeExtension.file_extension_id == file_extension_id,
            MimeTypeExtension.deleted_at.is_(None),
        )
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _build_response_dict(obj: MimeTypeExtension) -> dict[str, Any]:
    return {
        "mime_type_id": int(obj.mime_type_id),
        "file_extension_id": int(obj.file_extension_id),
        "is_default": bool(obj.is_default),
        "is_active": bool(obj.is_active),
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "created_by": _user_ref(getattr(obj, "created_by_user", None)),
        "updated_by": _user_ref(getattr(obj, "updated_by_user", None)),
        "deleted_by": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def get_mime_type_extension(db: Session, mime_type_id: int, file_extension_id: int) -> dict:
    obj = _get_or_404(db, mime_type_id, file_extension_id)
    return _build_response_dict(obj)


def list_mime_type_extensions(db: Session, filters: MimeTypeExtensionFilterRequest) -> dict:
    q = db.query(MimeTypeExtension).filter(MimeTypeExtension.deleted_at.is_(None))

    if filters.mime_type_id is not None:
        q = q.filter(MimeTypeExtension.mime_type_id == filters.mime_type_id)

    if filters.file_extension_id is not None:
        q = q.filter(MimeTypeExtension.file_extension_id == filters.file_extension_id)

    if filters.is_default is not None:
        q = q.filter(MimeTypeExtension.is_default == filters.is_default)

    if filters.is_active is not None:
        q = q.filter(MimeTypeExtension.is_active == filters.is_active)

    total = q.with_entities(func.count(MimeTypeExtension.mime_type_id)).scalar() or 0

    items = (
        q.options(
            joinedload(MimeTypeExtension.mime_type),
            joinedload(MimeTypeExtension.file_extension),
            joinedload(MimeTypeExtension.created_by_user),
            joinedload(MimeTypeExtension.updated_by_user),
            joinedload(MimeTypeExtension.deleted_by_user),
        )
        .order_by(MimeTypeExtension.mime_type_id.asc(), MimeTypeExtension.file_extension_id.asc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(x) for x in items],
        "total": int(total),
        "skip": filters.skip,
        "limit": filters.limit,
    }


def create_mime_type_extension(
    db: Session,
    body: MimeTypeExtensionCreateRequest,
    created_by_id: str,
) -> dict:
    existing = (
        db.query(MimeTypeExtension)
        .filter(
            MimeTypeExtension.mime_type_id == body.mime_type_id,
            MimeTypeExtension.file_extension_id == body.file_extension_id,
        )
        .first()
    )

    # Si existe y NO está borrado → conflicto
    if existing and existing.deleted_at is None:
        raise HTTPException(status_code=409, detail="MIME_TYPE_EXTENSION_ALREADY_EXISTS")

    now = datetime.utcnow()

    # Si existe soft-deleted → “revivir”
    if existing and existing.deleted_at is not None:
        existing.deleted_at = None
        existing.deleted_by = None
        existing.is_default = bool(body.is_default)
        existing.is_active = bool(body.is_active)
        existing.updated_by = created_by_id
        existing.updated_at = now

        db.commit()
        obj = _get_or_404(db, existing.mime_type_id, existing.file_extension_id)
        return _build_response_dict(obj)

    obj = MimeTypeExtension(
        mime_type_id=body.mime_type_id,
        file_extension_id=body.file_extension_id,
        is_default=bool(body.is_default),
        is_active=bool(body.is_active),
        created_by=created_by_id,
        created_at=now,
        updated_by=None,
        updated_at=None,
        deleted_by=None,
        deleted_at=None,
    )

    db.add(obj)
    db.commit()

    obj = _get_or_404(db, obj.mime_type_id, obj.file_extension_id)
    return _build_response_dict(obj)


def update_mime_type_extension(
    db: Session,
    mime_type_id: int,
    file_extension_id: int,
    body: MimeTypeExtensionUpdateRequest,
    updated_by_id: str,
) -> dict:
    obj = _get_or_404(db, mime_type_id, file_extension_id)

    if body.is_default is not None:
        obj.is_default = bool(body.is_default)

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id
    obj.updated_at = datetime.utcnow()

    db.commit()

    obj = _get_or_404(db, mime_type_id, file_extension_id)
    return _build_response_dict(obj)


def change_mime_type_extension_status(
    db: Session,
    mime_type_id: int,
    file_extension_id: int,
    is_active: bool,
    updated_by_id: str,
) -> dict:
    obj = _get_or_404(db, mime_type_id, file_extension_id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id
    obj.updated_at = datetime.utcnow()

    db.commit()

    obj = _get_or_404(db, mime_type_id, file_extension_id)
    return _build_response_dict(obj)


def delete_mime_type_extension(
    db: Session,
    mime_type_id: int,
    file_extension_id: int,
    deleted_by_id: str,
) -> None:
    obj = _get_or_404(db, mime_type_id, file_extension_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False

    db.commit()
    return None
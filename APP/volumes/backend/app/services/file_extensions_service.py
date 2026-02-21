from __future__ import annotations

import uuid  # noqa: F401 (compat / patrón)
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.file_extensions import FileExtension
from schemas.file_extensions import (
    FileExtensionCreateRequest,
    FileExtensionFilterRequest,
    FileExtensionUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: FileExtension) -> dict:
    return {
        "id": int(obj.id),
        "ext": obj.ext,
        "description": obj.description,
        "isActive": bool(obj.is_active),
        "createdAt": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updatedAt": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,
        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "updatedBy": _user_ref(getattr(obj, "updated_by_user", None)),
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,
    }


def _get_or_404(db: Session, id: int) -> FileExtension:
    obj = (
        db.query(FileExtension)
        .options(
            joinedload(FileExtension.created_by_user),
            joinedload(FileExtension.updated_by_user),
            joinedload(FileExtension.deleted_by_user),
        )
        .filter(FileExtension.id == id)
        .filter(FileExtension.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_ext(db: Session, ext: str, exclude_id: int | None = None) -> None:
    q = (
        db.query(FileExtension.id)
        .filter(FileExtension.ext == ext)
        .filter(FileExtension.deleted_at.is_(None))
    )
    if exclude_id is not None:
        q = q.filter(FileExtension.id != exclude_id)

    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="EXT_ALREADY_EXISTS")


def get_file_extension(db: Session, id: int) -> dict:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_file_extensions(db: Session, filters: FileExtensionFilterRequest) -> dict:
    q = db.query(FileExtension).filter(FileExtension.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(FileExtension.is_active.is_(bool(filters.is_active)))

    if filters.ext:
        q = q.filter(FileExtension.ext == filters.ext)

    total = q.with_entities(func.count(FileExtension.id)).scalar() or 0

    items = (
        q.options(
            joinedload(FileExtension.created_by_user),
            joinedload(FileExtension.updated_by_user),
            joinedload(FileExtension.deleted_by_user),
        )
        .order_by(FileExtension.ext.asc(), FileExtension.id.asc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(i) for i in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def create_file_extension(db: Session, body: FileExtensionCreateRequest, created_by_id: str) -> dict:
    ext_norm = body.ext.strip()
    if not ext_norm:
        raise HTTPException(status_code=409, detail="EXT_ALREADY_EXISTS")

    _check_unique_ext(db, ext_norm)

    obj = FileExtension(
        ext=ext_norm,
        description=body.description,
        is_active=bool(body.is_active),
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


def update_file_extension(db: Session, id: int, body: FileExtensionUpdateRequest, updated_by_id: str) -> dict:
    obj = _get_or_404(db, id)

    if body.ext is not None:
        ext_norm = body.ext.strip()
        if not ext_norm:
            raise HTTPException(status_code=409, detail="EXT_ALREADY_EXISTS")
        _check_unique_ext(db, ext_norm, exclude_id=id)
        obj.ext = ext_norm

    if body.description is not None:
        obj.description = body.description

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def change_file_extension_status(db: Session, id: int, is_active: bool, updated_by_id: str) -> dict:
    obj = _get_or_404(db, id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_file_extension(db: Session, id: int, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False

    db.commit()
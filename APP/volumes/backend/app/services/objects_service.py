# services/objects_service.py
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.objects import Object
from schemas.objects import ObjectCreateRequest, ObjectFilterRequest, ObjectUpdateRequest


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: Object) -> dict:
    return {
        "id": str(obj.id),
        "bucket_id": int(obj.bucket_id),
        "object_key": obj.object_key,
        "content_type": obj.content_type,
        "file_ext": obj.file_ext,
        "size_bytes": int(obj.size_bytes) if obj.size_bytes is not None else None,
        "etag": obj.etag,
        "sha256": obj.sha256,
        "created_at": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updated_at": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,
        "created_by": _user_ref(getattr(obj, "created_by_user", None)),
        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deleted_by": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, object_id: str) -> Object:
    obj = (
        db.query(Object)
        .options(
            joinedload(Object.bucket),
            joinedload(Object.created_by_user),
            joinedload(Object.deleted_by_user),
        )
        .filter(Object.id == object_id, Object.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_bucket_key(db: Session, bucket_id: int, object_key: str, exclude_id: str | None = None) -> None:
    q = db.query(Object).filter(
        Object.bucket_id == bucket_id,
        Object.object_key == object_key,
        Object.deleted_at.is_(None),
    )
    if exclude_id:
        q = q.filter(Object.id != exclude_id)
    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="BUCKET_KEY_ALREADY_EXISTS")


def get_object(db: Session, object_id: str) -> dict:
    obj = _get_or_404(db, object_id)
    return _build_response_dict(obj)


def list_objects(db: Session, filters: ObjectFilterRequest) -> dict:
    q = db.query(Object).filter(Object.deleted_at.is_(None))

    if filters.bucket_id is not None:
        q = q.filter(Object.bucket_id == filters.bucket_id)
    if filters.content_type:
        q = q.filter(Object.content_type == filters.content_type)
    if filters.sha256:
        q = q.filter(Object.sha256 == filters.sha256)
    if filters.object_key:
        q = q.filter(Object.object_key == filters.object_key)

    total = q.with_entities(func.count(Object.id)).scalar() or 0

    items = (
        q.options(
            joinedload(Object.bucket),
            joinedload(Object.created_by_user),
            joinedload(Object.deleted_by_user),
        )
        .order_by(Object.created_at.desc())
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


def create_object(db: Session, body: ObjectCreateRequest, created_by_id: str) -> dict:
    _check_unique_bucket_key(db, body.bucket_id, body.object_key, exclude_id=None)

    obj = Object(
        id=str(uuid.uuid4()),
        bucket_id=body.bucket_id,
        object_key=body.object_key,
        content_type=body.content_type,
        file_ext=body.file_ext,
        size_bytes=body.size_bytes,
        etag=body.etag,
        sha256=body.sha256,
        created_by=created_by_id,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_object(db: Session, object_id: str, body: ObjectUpdateRequest, updated_by_id: str) -> dict:
    obj = _get_or_404(db, object_id)

    new_bucket_id = body.bucket_id if body.bucket_id is not None else obj.bucket_id
    new_object_key = body.object_key if body.object_key is not None else obj.object_key

    if (new_bucket_id != obj.bucket_id) or (new_object_key != obj.object_key):
        _check_unique_bucket_key(db, int(new_bucket_id), str(new_object_key), exclude_id=obj.id)

    if body.bucket_id is not None:
        obj.bucket_id = body.bucket_id
    if body.object_key is not None:
        obj.object_key = body.object_key

    if body.content_type is not None:
        obj.content_type = body.content_type
    if body.file_ext is not None:
        obj.file_ext = body.file_ext

    if body.size_bytes is not None:
        obj.size_bytes = body.size_bytes
    if body.etag is not None:
        obj.etag = body.etag
    if body.sha256 is not None:
        obj.sha256 = body.sha256

    # No existe updated_by en la tabla; se conserva updated_at vía TimestampMixin
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_object(db: Session, object_id: str, deleted_by_id: str) -> None:
    obj = _get_or_404(db, object_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id

    db.commit()
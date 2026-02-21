# services/buckets_service.py
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from models.buckets import Bucket


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: Bucket) -> dict[str, Any]:
    return {
        "id": int(obj.id),
        "code": obj.code,
        "name": obj.name,
        "description": obj.description,
        "isActive": bool(obj.is_active),
        "createdAt": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updatedAt": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,
        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "updatedBy": _user_ref(getattr(obj, "updated_by_user", None)),
        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, id: int) -> Bucket:
    obj = (
        db.query(Bucket)
        .options(
            joinedload(Bucket.created_by_user),
            joinedload(Bucket.updated_by_user),
            joinedload(Bucket.deleted_by_user),
        )
        .filter(Bucket.id == id, Bucket.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="BUCKET_NOT_FOUND")
    return obj


def _check_unique_code(db: Session, code: str, exclude_id: int | None = None) -> None:
    q = db.query(Bucket).filter(Bucket.code == code, Bucket.deleted_at.is_(None))
    if exclude_id is not None:
        q = q.filter(Bucket.id != exclude_id)
    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="BUCKET_CODE_ALREADY_EXISTS")


def _check_unique_name(db: Session, name: str, exclude_id: int | None = None) -> None:
    q = db.query(Bucket).filter(Bucket.name == name, Bucket.deleted_at.is_(None))
    if exclude_id is not None:
        q = q.filter(Bucket.id != exclude_id)
    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="BUCKET_NAME_ALREADY_EXISTS")


def get_bucket(db: Session, id: int) -> dict[str, Any]:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_buckets(db: Session, filters) -> dict[str, Any]:
    q = db.query(Bucket).filter(Bucket.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(Bucket.is_active.is_(bool(filters.is_active)))

    if filters.code:
        q = q.filter(Bucket.code.like(f"%{filters.code}%"))

    if filters.name:
        q = q.filter(Bucket.name.like(f"%{filters.name}%"))

    if filters.q:
        term = f"%{filters.q}%"
        q = q.filter(or_(Bucket.code.like(term), Bucket.name.like(term)))

    total = q.with_entities(func.count(Bucket.id)).scalar() or 0

    items = (
        q.options(
            joinedload(Bucket.created_by_user),
            joinedload(Bucket.updated_by_user),
            joinedload(Bucket.deleted_by_user),
        )
        .order_by(Bucket.id.asc())
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


def create_bucket(db: Session, body, created_by_id: str | None) -> dict[str, Any]:
    _check_unique_code(db, body.code)
    _check_unique_name(db, body.name)

    obj = Bucket(
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


def update_bucket(db: Session, id: int, body, updated_by_id: str | None) -> dict[str, Any]:
    obj = _get_or_404(db, id)

    if body.code is not None and body.code != obj.code:
        _check_unique_code(db, body.code, exclude_id=id)
        obj.code = body.code

    if body.name is not None and body.name != obj.name:
        _check_unique_name(db, body.name, exclude_id=id)
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


def change_bucket_status(db: Session, id: int, is_active: bool, updated_by_id: str | None) -> dict[str, Any]:
    obj = _get_or_404(db, id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_bucket(db: Session, id: int, deleted_by_id: str | None) -> None:
    obj = _get_or_404(db, id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False

    db.commit()
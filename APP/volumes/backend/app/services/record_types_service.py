# services/record_types_service.py

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from models.record_types import RecordType
from schemas.record_types import RecordTypeCreateRequest, RecordTypeFilterRequest, RecordTypeUpdateRequest


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: RecordType) -> Dict[str, Any]:
    return {
        "id": int(obj.id),
        "code": obj.code,
        "name": obj.name,
        "description": obj.description,
        "is_active": bool(obj.is_active),

        "created_at": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updated_at": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,

        "created_by": _user_ref(getattr(obj, "created_by_user", None)),
        "updated_by": _user_ref(getattr(obj, "updated_by_user", None)),

        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deleted_by": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, id: int) -> RecordType:
    obj = (
        db.query(RecordType)
        .options(
            joinedload(RecordType.created_by_user),
            joinedload(RecordType.updated_by_user),
            joinedload(RecordType.deleted_by_user),
        )
        .filter(RecordType.id == id, RecordType.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_code(db: Session, code: str, exclude_id: int | None = None) -> None:
    q = db.query(RecordType).filter(RecordType.code == code, RecordType.deleted_at.is_(None))
    if exclude_id is not None:
        q = q.filter(RecordType.id != exclude_id)
    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="CODE_ALREADY_EXISTS")


def get_record_type(db: Session, id: int) -> Dict[str, Any]:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_record_types(db: Session, filters: RecordTypeFilterRequest) -> Dict[str, Any]:
    q = db.query(RecordType).filter(RecordType.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(RecordType.is_active.is_(bool(filters.is_active)))

    if filters.query:
        term = f"%{filters.query.strip()}%"
        q = q.filter(or_(RecordType.code.like(term), RecordType.name.like(term)))

    total = q.with_entities(func.count(RecordType.id)).scalar() or 0

    items = (
        q.options(
            joinedload(RecordType.created_by_user),
            joinedload(RecordType.updated_by_user),
            joinedload(RecordType.deleted_by_user),
        )
        .order_by(RecordType.id.asc())
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


def create_record_type(db: Session, body: RecordTypeCreateRequest, created_by_id: str) -> Dict[str, Any]:
    code = body.code.strip()
    name = body.name.strip()

    _check_unique_code(db, code)

    obj = RecordType(
        code=code,
        name=name,
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

    fresh = _get_or_404(db, obj.id)
    return _build_response_dict(fresh)


def update_record_type(db: Session, id: int, body: RecordTypeUpdateRequest, updated_by_id: str) -> Dict[str, Any]:
    obj = _get_or_404(db, id)

    if body.code is not None:
        code = body.code.strip()
        if code != obj.code:
            _check_unique_code(db, code, exclude_id=id)
            obj.code = code

    if body.name is not None:
        obj.name = body.name.strip()

    if body.description is not None:
        obj.description = body.description

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    fresh = _get_or_404(db, obj.id)
    return _build_response_dict(fresh)


def change_record_type_status(db: Session, id: int, is_active: bool, updated_by_id: str) -> Dict[str, Any]:
    obj = _get_or_404(db, id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    fresh = _get_or_404(db, obj.id)
    return _build_response_dict(fresh)


def delete_record_type(db: Session, id: int, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False
    obj.updated_by = deleted_by_id

    db.commit()
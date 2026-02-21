# services/record_statuses_service.py
from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.record_statuses import RecordStatus


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: RecordStatus) -> dict:
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


def _get_or_404(db: Session, id: int) -> RecordStatus:
    obj = (
        db.query(RecordStatus)
        .options(
            joinedload(RecordStatus.created_by_user),
            joinedload(RecordStatus.updated_by_user),
            joinedload(RecordStatus.deleted_by_user),
        )
        .filter(RecordStatus.id == id, RecordStatus.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_code(db: Session, code: str, exclude_id: int | None = None) -> None:
    q = db.query(RecordStatus).filter(
        RecordStatus.code == code,
        RecordStatus.deleted_at.is_(None),
    )
    if exclude_id is not None:
        q = q.filter(RecordStatus.id != exclude_id)

    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="CODE_ALREADY_EXISTS")


def get_record_status(db: Session, id: int) -> dict:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_record_statuses(db: Session, filters) -> dict:
    q = db.query(RecordStatus).filter(RecordStatus.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(RecordStatus.is_active == bool(filters.is_active))

    if filters.code:
        q = q.filter(RecordStatus.code.like(f"%{filters.code}%"))

    if filters.name:
        q = q.filter(RecordStatus.name.like(f"%{filters.name}%"))

    total = q.with_entities(func.count(RecordStatus.id)).scalar() or 0

    items = (
        q.options(
            joinedload(RecordStatus.created_by_user),
            joinedload(RecordStatus.updated_by_user),
            joinedload(RecordStatus.deleted_by_user),
        )
        .order_by(RecordStatus.id.asc())
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


def create_record_status(db: Session, body, created_by_id: str | None) -> dict:
    _check_unique_code(db, body.code)

    obj = RecordStatus(
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

    obj = _get_or_404(db, int(obj.id))
    return _build_response_dict(obj)


def update_record_status(db: Session, id: int, body, updated_by_id: str | None) -> dict:
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

    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def change_record_status_status(db: Session, id: int, is_active: bool, updated_by_id: str | None) -> dict:
    obj = _get_or_404(db, id)
    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def delete_record_status(db: Session, id: int, deleted_by_id: str | None) -> None:
    obj = _get_or_404(db, id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False
    obj.updated_by = deleted_by_id

    db.commit()
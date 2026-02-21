# services/version_statuses_service.py

from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from models.version_statuses import VersionStatus


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: VersionStatus) -> dict:
    return {
        "id": int(obj.id),
        "code": obj.code,
        "name": obj.name,
        "description": obj.description,
        "isActive": bool(obj.is_active),
        "createdAt": obj.created_at.isoformat() if obj.created_at else None,
        "updatedAt": obj.updated_at.isoformat() if obj.updated_at else None,
        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "updatedBy": _user_ref(getattr(obj, "updated_by_user", None)),
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, id: int) -> VersionStatus:
    obj = (
        db.query(VersionStatus)
        .options(
            joinedload(VersionStatus.created_by_user),
            joinedload(VersionStatus.updated_by_user),
            joinedload(VersionStatus.deleted_by_user),
        )
        .filter(VersionStatus.id == id, VersionStatus.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_code(db: Session, code: str, exclude_id: int | None = None) -> None:
    q = db.query(VersionStatus).filter(
        VersionStatus.code == code,
        VersionStatus.deleted_at.is_(None),
    )
    if exclude_id is not None:
        q = q.filter(VersionStatus.id != exclude_id)

    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="CODE_ALREADY_EXISTS")


def get_version_status(db: Session, id: int) -> dict:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_version_statuses(db: Session, filters) -> dict:
    q = db.query(VersionStatus).filter(VersionStatus.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(VersionStatus.is_active.is_(bool(filters.is_active)))

    if getattr(filters, "q", None):
        like = f"%{filters.q.strip()}%"
        q = q.filter(or_(VersionStatus.code.like(like), VersionStatus.name.like(like)))

    total = q.with_entities(func.count(VersionStatus.id)).scalar() or 0

    items = (
        q.options(
            joinedload(VersionStatus.created_by_user),
            joinedload(VersionStatus.updated_by_user),
            joinedload(VersionStatus.deleted_by_user),
        )
        .order_by(VersionStatus.id.asc())
        .offset(int(filters.skip))
        .limit(int(filters.limit))
        .all()
    )

    return {
        "items": [_build_response_dict(x) for x in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def create_version_status(db: Session, body, created_by_id: str | None) -> dict:
    _check_unique_code(db, body.code)

    obj = VersionStatus(
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


def update_version_status(db: Session, id: int, body, updated_by_id: str | None) -> dict:
    obj = _get_or_404(db, id)

    if body.code is not None and body.code != obj.code:
        _check_unique_code(db, body.code, exclude_id=id)
        obj.code = body.code

    if body.name is not None:
        obj.name = body.name

    if body.description is not None or body.description is None:
        # Permite setear explícitamente NULL.
        obj.description = body.description

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def change_version_status_status(db: Session, id: int, is_active: bool, updated_by_id: str | None) -> dict:
    obj = _get_or_404(db, id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def delete_version_status(db: Session, id: int, deleted_by_id: str | None) -> None:
    obj = _get_or_404(db, id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False

    db.commit()
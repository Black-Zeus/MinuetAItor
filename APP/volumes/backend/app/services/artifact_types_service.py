# services/artifact_types_service.py

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.artifact_types import ArtifactType
from schemas.artifact_types import ArtifactTypeCreateRequest, ArtifactTypeFilterRequest, ArtifactTypeUpdateRequest


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: ArtifactType) -> dict[str, Any]:
    return {
        "id": int(obj.id),
        "code": obj.code,
        "name": obj.name,
        "description": obj.description,
        "is_active": bool(obj.is_active),
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
        "created_by": _user_ref(getattr(obj, "created_by_user", None)),
        "updated_by": _user_ref(getattr(obj, "updated_by_user", None)),
        "deleted_at": obj.deleted_at,
        "deleted_by": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, id: int) -> ArtifactType:
    obj = (
        db.query(ArtifactType)
        .options(
            joinedload(ArtifactType.created_by_user),
            joinedload(ArtifactType.updated_by_user),
            joinedload(ArtifactType.deleted_by_user),
        )
        .filter(ArtifactType.id == id, ArtifactType.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="ARTIFACT_TYPE_NOT_FOUND")
    return obj


def _check_unique_code(db: Session, code: str, exclude_id: int | None = None) -> None:
    q = db.query(ArtifactType).filter(
        ArtifactType.code == code,
        ArtifactType.deleted_at.is_(None),
    )
    if exclude_id is not None:
        q = q.filter(ArtifactType.id != exclude_id)

    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="ARTIFACT_TYPE_CODE_ALREADY_EXISTS")


def get_artifact_type(db: Session, id: int) -> dict[str, Any]:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_artifact_types(db: Session, filters: ArtifactTypeFilterRequest) -> dict[str, Any]:
    q = db.query(ArtifactType).filter(ArtifactType.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(ArtifactType.is_active.is_(bool(filters.is_active)))

    if filters.code:
        q = q.filter(ArtifactType.code.ilike(f"%{filters.code}%"))

    if filters.name:
        q = q.filter(ArtifactType.name.ilike(f"%{filters.name}%"))

    total = q.with_entities(func.count(ArtifactType.id)).scalar() or 0

    items = (
        q.options(
            joinedload(ArtifactType.created_by_user),
            joinedload(ArtifactType.updated_by_user),
            joinedload(ArtifactType.deleted_by_user),
        )
        .order_by(ArtifactType.id.asc())
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


def create_artifact_type(db: Session, body: ArtifactTypeCreateRequest, created_by_id: str) -> dict[str, Any]:
    _check_unique_code(db, body.code)

    obj = ArtifactType(
        code=body.code,
        name=body.name,
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

    obj = _get_or_404(db, int(obj.id))
    return _build_response_dict(obj)


def update_artifact_type(db: Session, id: int, body: ArtifactTypeUpdateRequest, updated_by_id: str) -> dict[str, Any]:
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


def change_artifact_type_status(db: Session, id: int, is_active: bool, updated_by_id: str) -> dict[str, Any]:
    obj = _get_or_404(db, id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def delete_artifact_type(db: Session, id: int, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False
    obj.updated_by = deleted_by_id

    db.commit()
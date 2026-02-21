# services/record_type_artifact_types_service.py

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from models.record_type_artifact_types import RecordTypeArtifactType
from schemas.record_type_artifact_types import (
    RecordTypeArtifactTypesCreateRequest,
    RecordTypeArtifactTypesFilterRequest,
    RecordTypeArtifactTypesUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _entity_ref(obj) -> dict | None:
    if not obj:
        return None
    return {
        "id": int(getattr(obj, "id")),
        "code": getattr(obj, "code", None),
        "name": getattr(obj, "name", None),
    }


def _base_query(db: Session):
    return db.query(RecordTypeArtifactType).filter(RecordTypeArtifactType.deleted_at.is_(None))


def _get_or_404(db: Session, record_type_id: int, artifact_type_id: int) -> RecordTypeArtifactType:
    obj = (
        _base_query(db)
        .options(
            joinedload(RecordTypeArtifactType.record_type),
            joinedload(RecordTypeArtifactType.artifact_type),
            joinedload(RecordTypeArtifactType.created_by_user),
            joinedload(RecordTypeArtifactType.updated_by_user),
            joinedload(RecordTypeArtifactType.deleted_by_user),
        )
        .filter(
            and_(
                RecordTypeArtifactType.record_type_id == record_type_id,
                RecordTypeArtifactType.artifact_type_id == artifact_type_id,
            )
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _build_response_dict(obj: RecordTypeArtifactType) -> dict[str, Any]:
    return {
        "record_type_id": int(obj.record_type_id),
        "artifact_type_id": int(obj.artifact_type_id),
        "is_required_on_publish": bool(obj.is_required_on_publish),
        "max_count": int(obj.max_count),
        "is_active": bool(obj.is_active),
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
        "deleted_at": obj.deleted_at,
        "created_by": _user_ref(getattr(obj, "created_by_user", None)),
        "updated_by": _user_ref(getattr(obj, "updated_by_user", None)),
        "deleted_by": _user_ref(getattr(obj, "deleted_by_user", None)),
        "record_type": _entity_ref(getattr(obj, "record_type", None)),
        "artifact_type": _entity_ref(getattr(obj, "artifact_type", None)),
    }


def get_record_type_artifact_type(db: Session, record_type_id: int, artifact_type_id: int) -> dict:
    obj = _get_or_404(db, record_type_id, artifact_type_id)
    return _build_response_dict(obj)


def list_record_type_artifact_types(db: Session, filters: RecordTypeArtifactTypesFilterRequest) -> dict:
    q = _base_query(db)

    if filters.is_active is not None:
        q = q.filter(RecordTypeArtifactType.is_active.is_(filters.is_active))

    if filters.record_type_id is not None:
        q = q.filter(RecordTypeArtifactType.record_type_id == filters.record_type_id)

    if filters.artifact_type_id is not None:
        q = q.filter(RecordTypeArtifactType.artifact_type_id == filters.artifact_type_id)

    if filters.is_required_on_publish is not None:
        q = q.filter(RecordTypeArtifactType.is_required_on_publish.is_(filters.is_required_on_publish))

    total = q.with_entities(func.count(RecordTypeArtifactType.record_type_id)).scalar() or 0

    items = (
        q.options(
            joinedload(RecordTypeArtifactType.record_type),
            joinedload(RecordTypeArtifactType.artifact_type),
            joinedload(RecordTypeArtifactType.created_by_user),
            joinedload(RecordTypeArtifactType.updated_by_user),
            joinedload(RecordTypeArtifactType.deleted_by_user),
        )
        .order_by(RecordTypeArtifactType.record_type_id.asc(), RecordTypeArtifactType.artifact_type_id.asc())
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


def create_record_type_artifact_type(
    db: Session,
    body: RecordTypeArtifactTypesCreateRequest,
    created_by_id: str,
) -> dict:
    exists = (
        _base_query(db)
        .filter(
            and_(
                RecordTypeArtifactType.record_type_id == body.record_type_id,
                RecordTypeArtifactType.artifact_type_id == body.artifact_type_id,
            )
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="RECORD_TYPE_ARTIFACT_TYPE_ALREADY_EXISTS")

    obj = RecordTypeArtifactType(
        record_type_id=body.record_type_id,
        artifact_type_id=body.artifact_type_id,
        is_required_on_publish=bool(body.is_required_on_publish),
        max_count=int(body.max_count),
        is_active=bool(body.is_active),
        created_by=created_by_id,
        updated_by=None,
    )

    db.add(obj)
    db.commit()

    obj = _get_or_404(db, body.record_type_id, body.artifact_type_id)
    return _build_response_dict(obj)


def update_record_type_artifact_type(
    db: Session,
    record_type_id: int,
    artifact_type_id: int,
    body: RecordTypeArtifactTypesUpdateRequest,
    updated_by_id: str,
) -> dict:
    obj = _get_or_404(db, record_type_id, artifact_type_id)

    if body.is_required_on_publish is not None:
        obj.is_required_on_publish = bool(body.is_required_on_publish)

    if body.max_count is not None:
        obj.max_count = int(body.max_count)

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.add(obj)
    db.commit()

    obj = _get_or_404(db, record_type_id, artifact_type_id)
    return _build_response_dict(obj)


def change_record_type_artifact_type_status(
    db: Session,
    record_type_id: int,
    artifact_type_id: int,
    is_active: bool,
    updated_by_id: str,
) -> dict:
    obj = _get_or_404(db, record_type_id, artifact_type_id)
    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.add(obj)
    db.commit()

    obj = _get_or_404(db, record_type_id, artifact_type_id)
    return _build_response_dict(obj)


def delete_record_type_artifact_type(
    db: Session,
    record_type_id: int,
    artifact_type_id: int,
    deleted_by_id: str,
) -> None:
    obj = _get_or_404(db, record_type_id, artifact_type_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False

    db.add(obj)
    db.commit()
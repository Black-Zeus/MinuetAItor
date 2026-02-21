# services/record_artifacts_service.py
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.record_artifacts import RecordArtifact
from schemas.record_artifacts import (
    RecordArtifactCreateRequest,
    RecordArtifactFilterRequest,
    RecordArtifactUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: RecordArtifact) -> dict[str, Any]:
    return {
        "id": int(obj.id),
        "recordId": obj.record_id,
        "recordVersionId": obj.record_version_id,
        "isDraft": bool(obj.is_draft),
        "artifactTypeId": int(obj.artifact_type_id),
        "artifactStateId": int(obj.artifact_state_id),
        "objectId": obj.object_id,
        "naturalName": obj.natural_name,
        "createdAt": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, id: int) -> RecordArtifact:
    q = (
        db.query(RecordArtifact)
        .options(
            joinedload(RecordArtifact.record),
            joinedload(RecordArtifact.record_version),
            joinedload(RecordArtifact.artifact_type),
            joinedload(RecordArtifact.artifact_state),
            joinedload(RecordArtifact.object),
            joinedload(RecordArtifact.created_by_user),
            joinedload(RecordArtifact.deleted_by_user),
        )
        .filter(RecordArtifact.id == id)
        .filter(RecordArtifact.deleted_at.is_(None))
    )

    obj = q.first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def get_record_artifact(db: Session, id: int) -> dict:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_record_artifacts(db: Session, filters: RecordArtifactFilterRequest) -> dict:
    q = db.query(RecordArtifact)

    if not filters.include_deleted:
        q = q.filter(RecordArtifact.deleted_at.is_(None))

    if filters.record_id:
        q = q.filter(RecordArtifact.record_id == filters.record_id)

    if filters.record_version_id:
        q = q.filter(RecordArtifact.record_version_id == filters.record_version_id)

    if filters.object_id:
        q = q.filter(RecordArtifact.object_id == filters.object_id)

    if filters.artifact_type_id is not None:
        q = q.filter(RecordArtifact.artifact_type_id == int(filters.artifact_type_id))

    if filters.artifact_state_id is not None:
        q = q.filter(RecordArtifact.artifact_state_id == int(filters.artifact_state_id))

    if filters.is_draft is not None:
        q = q.filter(RecordArtifact.is_draft == bool(filters.is_draft))

    total = q.with_entities(func.count(RecordArtifact.id)).scalar() or 0

    items = (
        q.options(
            joinedload(RecordArtifact.record),
            joinedload(RecordArtifact.record_version),
            joinedload(RecordArtifact.artifact_type),
            joinedload(RecordArtifact.artifact_state),
            joinedload(RecordArtifact.object),
            joinedload(RecordArtifact.created_by_user),
            joinedload(RecordArtifact.deleted_by_user),
        )
        .order_by(RecordArtifact.id.desc())
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


def create_record_artifact(db: Session, body: RecordArtifactCreateRequest, created_by_id: str) -> dict:
    obj = RecordArtifact(
        record_id=body.record_id,
        record_version_id=body.record_version_id,
        is_draft=bool(body.is_draft),
        artifact_type_id=int(body.artifact_type_id),
        artifact_state_id=int(body.artifact_state_id),
        object_id=body.object_id,
        natural_name=body.natural_name,
        created_by=created_by_id,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, int(obj.id))
    return _build_response_dict(obj)


def update_record_artifact(db: Session, id: int, body: RecordArtifactUpdateRequest) -> dict:
    obj = _get_or_404(db, id)

    if body.record_id is not None:
        obj.record_id = body.record_id

    if body.record_version_id is not None:
        obj.record_version_id = body.record_version_id

    if body.is_draft is not None:
        obj.is_draft = bool(body.is_draft)

    if body.artifact_type_id is not None:
        obj.artifact_type_id = int(body.artifact_type_id)

    if body.artifact_state_id is not None:
        obj.artifact_state_id = int(body.artifact_state_id)

    if body.object_id is not None:
        obj.object_id = body.object_id

    if body.natural_name is not None:
        obj.natural_name = body.natural_name

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def delete_record_artifact(db: Session, id: int, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id

    db.commit()
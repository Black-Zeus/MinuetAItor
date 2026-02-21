from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.artifact_type_mime_types import ArtifactTypeMimeType


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: ArtifactTypeMimeType) -> dict[str, Any]:
    return {
        "artifactTypeId": int(obj.artifact_type_id),
        "mimeTypeId": int(obj.mime_type_id),
        "isDefault": bool(obj.is_default),
        "isActive": bool(obj.is_active),
        "createdAt": obj.created_at.isoformat() if obj.created_at else None,
        "updatedAt": obj.updated_at.isoformat() if obj.updated_at else None,
        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "updatedBy": _user_ref(getattr(obj, "updated_by_user", None)),
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, artifact_type_id: int, mime_type_id: int) -> ArtifactTypeMimeType:
    q = (
        db.query(ArtifactTypeMimeType)
        .options(
            joinedload(ArtifactTypeMimeType.artifact_type),
            joinedload(ArtifactTypeMimeType.mime_type),
            joinedload(ArtifactTypeMimeType.created_by_user),
            joinedload(ArtifactTypeMimeType.updated_by_user),
            joinedload(ArtifactTypeMimeType.deleted_by_user),
        )
        .filter(
            ArtifactTypeMimeType.artifact_type_id == artifact_type_id,
            ArtifactTypeMimeType.mime_type_id == mime_type_id,
            ArtifactTypeMimeType.deleted_at.is_(None),
        )
    )
    obj = q.first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def get_artifact_type_mime_type(db: Session, artifact_type_id: int, mime_type_id: int) -> dict[str, Any]:
    obj = _get_or_404(db, artifact_type_id, mime_type_id)
    return _build_response_dict(obj)


def list_artifact_type_mime_types(db: Session, filters) -> dict[str, Any]:
    q = db.query(ArtifactTypeMimeType).filter(ArtifactTypeMimeType.deleted_at.is_(None))

    if getattr(filters, "artifact_type_id", None) is not None:
        q = q.filter(ArtifactTypeMimeType.artifact_type_id == filters.artifact_type_id)

    if getattr(filters, "mime_type_id", None) is not None:
        q = q.filter(ArtifactTypeMimeType.mime_type_id == filters.mime_type_id)

    if getattr(filters, "is_default", None) is not None:
        q = q.filter(ArtifactTypeMimeType.is_default == filters.is_default)

    if getattr(filters, "is_active", None) is not None:
        q = q.filter(ArtifactTypeMimeType.is_active == filters.is_active)

    total = q.with_entities(func.count()).scalar() or 0

    items = (
        q.options(
            joinedload(ArtifactTypeMimeType.artifact_type),
            joinedload(ArtifactTypeMimeType.mime_type),
            joinedload(ArtifactTypeMimeType.created_by_user),
            joinedload(ArtifactTypeMimeType.updated_by_user),
            joinedload(ArtifactTypeMimeType.deleted_by_user),
        )
        .order_by(ArtifactTypeMimeType.artifact_type_id.asc(), ArtifactTypeMimeType.mime_type_id.asc())
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


def create_artifact_type_mime_type(db: Session, body, created_by_id: str) -> dict[str, Any]:
    exists = (
        db.query(ArtifactTypeMimeType)
        .filter(
            ArtifactTypeMimeType.artifact_type_id == body.artifact_type_id,
            ArtifactTypeMimeType.mime_type_id == body.mime_type_id,
            ArtifactTypeMimeType.deleted_at.is_(None),
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="RELATION_ALREADY_EXISTS")

    obj = ArtifactTypeMimeType(
        artifact_type_id=body.artifact_type_id,
        mime_type_id=body.mime_type_id,
        is_default=bool(body.is_default),
        is_active=bool(body.is_active),
        created_by=created_by_id,
    )

    db.add(obj)
    db.commit()

    obj = _get_or_404(db, obj.artifact_type_id, obj.mime_type_id)
    return _build_response_dict(obj)


def update_artifact_type_mime_type(
    db: Session,
    artifact_type_id: int,
    mime_type_id: int,
    body,
    updated_by_id: str,
) -> dict[str, Any]:
    obj = _get_or_404(db, artifact_type_id, mime_type_id)

    if body.is_default is not None:
        obj.is_default = bool(body.is_default)
    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.commit()

    obj = _get_or_404(db, artifact_type_id, mime_type_id)
    return _build_response_dict(obj)


def change_artifact_type_mime_type_status(
    db: Session,
    artifact_type_id: int,
    mime_type_id: int,
    is_active: bool,
    updated_by_id: str,
) -> dict[str, Any]:
    obj = _get_or_404(db, artifact_type_id, mime_type_id)
    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()

    obj = _get_or_404(db, artifact_type_id, mime_type_id)
    return _build_response_dict(obj)


def delete_artifact_type_mime_type(
    db: Session,
    artifact_type_id: int,
    mime_type_id: int,
    deleted_by_id: str,
) -> None:
    obj = _get_or_404(db, artifact_type_id, mime_type_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False

    db.commit()
    return None
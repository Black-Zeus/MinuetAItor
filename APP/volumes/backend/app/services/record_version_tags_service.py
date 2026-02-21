# services/record_version_tags_service.py

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.record_version_tags import RecordVersionTag


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: RecordVersionTag) -> dict[str, Any]:
    return {
        "recordVersionId": str(obj.record_version_id),
        "tagId": str(obj.tag_id),
        "addedAt": obj.added_at.isoformat() if obj.added_at else None,
        "addedBy": _user_ref(obj.added_by_user),
    }


def _get_or_404(db: Session, record_version_id: str, tag_id: str) -> RecordVersionTag:
    q = (
        db.query(RecordVersionTag)
        .options(joinedload(RecordVersionTag.added_by_user))
        .filter(
            RecordVersionTag.record_version_id == record_version_id,
            RecordVersionTag.tag_id == tag_id,
        )
    )
    obj = q.first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def get_record_version_tag(db: Session, record_version_id: str, tag_id: str) -> dict:
    obj = _get_or_404(db, record_version_id, tag_id)
    return _build_response_dict(obj)


def list_record_version_tags(db: Session, filters) -> dict:
    q = db.query(RecordVersionTag)

    if getattr(filters, "record_version_id", None):
        q = q.filter(RecordVersionTag.record_version_id == filters.record_version_id)
    if getattr(filters, "tag_id", None):
        q = q.filter(RecordVersionTag.tag_id == filters.tag_id)
    if getattr(filters, "added_by", None):
        q = q.filter(RecordVersionTag.added_by == filters.added_by)

    total = q.with_entities(func.count(RecordVersionTag.tag_id)).scalar() or 0

    items = (
        q.options(joinedload(RecordVersionTag.added_by_user))
        .order_by(RecordVersionTag.added_at.desc())
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


def create_record_version_tag(
    db: Session,
    body,
    added_by_id: str | None,
) -> dict:
    exists = (
        db.query(RecordVersionTag)
        .filter(
            RecordVersionTag.record_version_id == body.record_version_id,
            RecordVersionTag.tag_id == body.tag_id,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="RECORD_VERSION_TAG_ALREADY_EXISTS")

    obj = RecordVersionTag(
        record_version_id=body.record_version_id,
        tag_id=body.tag_id,
        added_by=added_by_id,
    )

    db.add(obj)
    db.commit()

    obj = _get_or_404(db, body.record_version_id, body.tag_id)
    return _build_response_dict(obj)


def touch_record_version_tag(
    db: Session,
    record_version_id: str,
    tag_id: str,
    updated_by_id: str | None,
) -> dict:
    """
    Operación tipo PUT: 'tocar' la relación para refrescar auditoría.
    """
    obj = _get_or_404(db, record_version_id, tag_id)

    obj.added_at = datetime.utcnow()
    obj.added_by = updated_by_id

    db.add(obj)
    db.commit()

    obj = _get_or_404(db, record_version_id, tag_id)
    return _build_response_dict(obj)


def delete_record_version_tag(db: Session, record_version_id: str, tag_id: str) -> None:
    obj = _get_or_404(db, record_version_id, tag_id)
    db.delete(obj)
    db.commit()
    return None
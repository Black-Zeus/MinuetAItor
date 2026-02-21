# services/record_version_ai_tags_service.py
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from models.record_version_ai_tags import RecordVersionAiTag


def _get_or_404(db: Session, record_version_id: str, ai_tag_id: str) -> RecordVersionAiTag:
    obj = (
        db.query(RecordVersionAiTag)
        .options(
            joinedload(RecordVersionAiTag.record_version),
            joinedload(RecordVersionAiTag.ai_tag),
        )
        .filter(
            RecordVersionAiTag.record_version_id == record_version_id,
            RecordVersionAiTag.ai_tag_id == ai_tag_id,
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _build_response_dict(obj: RecordVersionAiTag) -> dict[str, Any]:
    return {
        "recordVersionId": str(obj.record_version_id),
        "aiTagId": str(obj.ai_tag_id),
        "detectedAt": obj.detected_at.isoformat() if obj.detected_at else None,
    }


def get_record_version_ai_tag(db: Session, record_version_id: str, ai_tag_id: str) -> dict[str, Any]:
    obj = _get_or_404(db, record_version_id, ai_tag_id)
    return _build_response_dict(obj)


def list_record_version_ai_tags(db: Session, filters) -> dict[str, Any]:
    q = db.query(RecordVersionAiTag)

    conds = []
    if getattr(filters, "record_version_id", None):
        conds.append(RecordVersionAiTag.record_version_id == filters.record_version_id)
    if getattr(filters, "ai_tag_id", None):
        conds.append(RecordVersionAiTag.ai_tag_id == filters.ai_tag_id)

    detected_from = getattr(filters, "detected_from", None)
    detected_to = getattr(filters, "detected_to", None)
    if detected_from:
        conds.append(RecordVersionAiTag.detected_at >= detected_from)
    if detected_to:
        conds.append(RecordVersionAiTag.detected_at <= detected_to)

    if conds:
        q = q.filter(and_(*conds))

    total = q.with_entities(func.count()).scalar() or 0

    items = (
        q.options(
            joinedload(RecordVersionAiTag.record_version),
            joinedload(RecordVersionAiTag.ai_tag),
        )
        .order_by(RecordVersionAiTag.detected_at.desc())
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


def create_record_version_ai_tag(db: Session, body) -> dict[str, Any]:
    exists = (
        db.query(RecordVersionAiTag)
        .filter(
            RecordVersionAiTag.record_version_id == body.record_version_id,
            RecordVersionAiTag.ai_tag_id == body.ai_tag_id,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="RELATION_ALREADY_EXISTS")

    obj = RecordVersionAiTag(
        record_version_id=body.record_version_id,
        ai_tag_id=body.ai_tag_id,
        detected_at=body.detected_at or datetime.utcnow(),
    )

    db.add(obj)
    db.commit()

    obj = _get_or_404(db, obj.record_version_id, obj.ai_tag_id)
    return _build_response_dict(obj)


def update_record_version_ai_tag(db: Session, record_version_id: str, ai_tag_id: str, body) -> dict[str, Any]:
    obj = _get_or_404(db, record_version_id, ai_tag_id)

    if body.detected_at is not None:
        obj.detected_at = body.detected_at

    db.commit()

    obj = _get_or_404(db, record_version_id, ai_tag_id)
    return _build_response_dict(obj)


def delete_record_version_ai_tag(db: Session, record_version_id: str, ai_tag_id: str) -> None:
    obj = _get_or_404(db, record_version_id, ai_tag_id)
    db.delete(obj)
    db.commit()
# services/ai_tags_service.py
import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.ai_tags import AITag
from schemas.ai_tags import AITagCreateRequest, AITagFilterRequest, AITagUpdateRequest


def _get_or_404(db: Session, id: str) -> AITag:
    obj = db.query(AITag).filter(AITag.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_slug(db: Session, slug: str, exclude_id: str | None = None) -> None:
    q = db.query(AITag).filter(AITag.slug == slug)
    if exclude_id:
        q = q.filter(AITag.id != exclude_id)

    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="SLUG_ALREADY_EXISTS")


def _build_response_dict(obj: AITag) -> dict:
    return {
        "id": str(obj.id),
        "slug": obj.slug,
        "description": obj.description,
        "isActive": bool(obj.is_active),
        "createdAt": obj.created_at.isoformat() if obj.created_at else None,
    }


def get_ai_tag(db: Session, id: str) -> dict:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_ai_tags(db: Session, filters: AITagFilterRequest) -> dict:
    q = db.query(AITag)

    if filters.is_active is not None:
        q = q.filter(AITag.is_active.is_(bool(filters.is_active)))

    if filters.slug:
        q = q.filter(AITag.slug.ilike(f"%{filters.slug}%"))

    total = q.with_entities(func.count(AITag.id)).scalar() or 0

    items = (
        q.order_by(AITag.slug.asc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(it) for it in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def create_ai_tag(db: Session, body: AITagCreateRequest) -> dict:
    _check_unique_slug(db, slug=body.slug, exclude_id=None)

    obj = AITag(
        id=str(uuid.uuid4()),
        slug=body.slug,
        description=body.description,
        is_active=bool(body.is_active),
        created_at=datetime.utcnow(),
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_ai_tag(db: Session, id: str, body: AITagUpdateRequest) -> dict:
    obj = _get_or_404(db, id)

    next_slug = body.slug if body.slug is not None else obj.slug
    _check_unique_slug(db, slug=next_slug, exclude_id=obj.id)

    if body.slug is not None:
        obj.slug = body.slug
    if body.description is not None:
        obj.description = body.description
    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def change_ai_tag_status(db: Session, id: str, is_active: bool) -> dict:
    obj = _get_or_404(db, id)

    obj.is_active = bool(is_active)

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_ai_tag(db: Session, id: str) -> None:
    obj = _get_or_404(db, id)
    db.delete(obj)
    db.commit()

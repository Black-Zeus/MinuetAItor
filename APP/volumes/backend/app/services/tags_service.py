# services/tags_service.py
import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.tags import Tag
from schemas.tags import TagCreateRequest, TagFilterRequest, TagUpdateRequest


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _get_or_404(db: Session, id: str) -> Tag:
    q = (
        db.query(Tag)
        .filter(Tag.id == id, Tag.deleted_at.is_(None))
        .options(
            joinedload(Tag.created_by_user),
            joinedload(Tag.updated_by_user),
            joinedload(Tag.deleted_by_user),
            joinedload(Tag.category),
        )
    )
    obj = q.first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_cat_name(db: Session, category_id: int, name: str, exclude_id: str | None = None) -> None:
    q = db.query(Tag).filter(
        Tag.category_id == category_id,
        Tag.name == name,
        Tag.deleted_at.is_(None),
    )
    if exclude_id:
        q = q.filter(Tag.id != exclude_id)

    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="TAG_ALREADY_EXISTS")


def _build_response_dict(obj: Tag) -> dict:
    return {
        "id": str(obj.id),
        "categoryId": int(obj.category_id),
        "name": obj.name,
        "description": obj.description,
        "source": str(obj.source.value) if hasattr(obj.source, "value") else str(obj.source),
        "status": obj.status,
        "isActive": bool(obj.is_active),
        "createdAt": obj.created_at.isoformat() if obj.created_at else None,
        "updatedAt": obj.updated_at.isoformat() if obj.updated_at else None,
        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "updatedBy": _user_ref(getattr(obj, "updated_by_user", None)),
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def get_tag(db: Session, id: str) -> dict:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_tags(db: Session, filters: TagFilterRequest) -> dict:
    q = db.query(Tag).filter(Tag.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(Tag.is_active.is_(bool(filters.is_active)))

    if filters.category_id is not None:
        q = q.filter(Tag.category_id == int(filters.category_id))

    if filters.source is not None:
        q = q.filter(Tag.source == filters.source.value)

    if filters.status is not None:
        q = q.filter(Tag.status == filters.status)

    if filters.name:
        q = q.filter(Tag.name.ilike(f"%{filters.name}%"))

    total = q.with_entities(func.count(Tag.id)).scalar() or 0

    items = (
        q.options(
            joinedload(Tag.created_by_user),
            joinedload(Tag.updated_by_user),
            joinedload(Tag.deleted_by_user),
            joinedload(Tag.category),
        )
        .order_by(Tag.name.asc())
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


def create_tag(db: Session, body: TagCreateRequest, created_by_id: str) -> dict:
    _check_unique_cat_name(db, category_id=int(body.category_id), name=body.name, exclude_id=None)

    obj = Tag(
        id=str(uuid.uuid4()),
        category_id=int(body.category_id),
        name=body.name,
        description=body.description,
        source=body.source.value,
        status=body.status,
        is_active=bool(body.is_active),
        created_by=created_by_id,
        updated_by=None,
        deleted_at=None,
        deleted_by=None,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_tag(db: Session, id: str, body: TagUpdateRequest, updated_by_id: str) -> dict:
    obj = _get_or_404(db, id)

    next_category_id = int(body.category_id) if body.category_id is not None else int(obj.category_id)
    next_name = body.name if body.name is not None else obj.name
    _check_unique_cat_name(db, category_id=next_category_id, name=next_name, exclude_id=obj.id)

    if body.category_id is not None:
        obj.category_id = int(body.category_id)
    if body.name is not None:
        obj.name = body.name
    if body.description is not None:
        obj.description = body.description
    if body.source is not None:
        obj.source = body.source.value
    if body.status is not None:
        obj.status = body.status
    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def change_tag_status(db: Session, id: str, is_active: bool, updated_by_id: str) -> dict:
    obj = _get_or_404(db, id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_tag(db: Session, id: str, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False
    obj.updated_by = deleted_by_id

    db.commit()

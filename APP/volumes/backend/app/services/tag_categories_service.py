# services/tag_categories_service.py

import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.tag_categories import TagCategory
from schemas.tag_categories import (
    TagCategoryCreateRequest,
    TagCategoryFilterRequest,
    TagCategoryUpdateRequest,
)


def _get_or_404(db: Session, id: int) -> TagCategory:
    obj = db.query(TagCategory).filter(TagCategory.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_name(db: Session, name: str, exclude_id: int | None = None) -> None:
    q = db.query(TagCategory).filter(func.lower(TagCategory.name) == func.lower(name))
    if exclude_id is not None:
        q = q.filter(TagCategory.id != exclude_id)

    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="NAME_ALREADY_EXISTS")


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: TagCategory) -> dict[str, Any]:
    return {
        "id": int(obj.id),
        "name": obj.name,
        "is_active": bool(obj.is_active),
    }


def get_tag_category(db: Session, id: int) -> dict[str, Any]:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_tag_categories(db: Session, filters: TagCategoryFilterRequest) -> dict[str, Any]:
    q = db.query(TagCategory)

    if filters.is_active is not None:
        q = q.filter(TagCategory.is_active.is_(filters.is_active))

    if filters.q:
        like = f"%{filters.q.strip()}%"
        q = q.filter(TagCategory.name.like(like))

    total = q.with_entities(func.count(TagCategory.id)).scalar() or 0

    items = (
        q.order_by(TagCategory.name.asc())
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


def create_tag_category(
    db: Session,
    body: TagCategoryCreateRequest,
    created_by_id: str,
) -> dict[str, Any]:
    _check_unique_name(db, body.name)

    obj = TagCategory(
        name=body.name.strip(),
        is_active=bool(body.is_active),
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_tag_category(
    db: Session,
    id: int,
    body: TagCategoryUpdateRequest,
    updated_by_id: str,
) -> dict[str, Any]:
    obj = _get_or_404(db, id)

    if body.name is not None:
        new_name = body.name.strip()
        if new_name != obj.name:
            _check_unique_name(db, new_name, exclude_id=id)
            obj.name = new_name

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def change_tag_category_status(
    db: Session,
    id: int,
    is_active: bool,
    updated_by_id: str,
) -> dict[str, Any]:
    obj = _get_or_404(db, id)
    obj.is_active = bool(is_active)

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_tag_category(db: Session, id: int, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)
    db.delete(obj)
    db.commit()

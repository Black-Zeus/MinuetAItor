# services/ai_profile_categories_service.py
from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.ai_profile_categories import AiProfileCategory
from schemas.ai_profile_categories import (
    AiProfileCategoryCreateRequest,
    AiProfileCategoryFilterRequest,
    AiProfileCategoryUpdateRequest,
)


def _get_or_404(db: Session, id: int) -> AiProfileCategory:
    obj = (
        db.query(AiProfileCategory)
        .filter(AiProfileCategory.id == id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_name(db: Session, name: str, exclude_id: int | None = None) -> None:
    q = db.query(AiProfileCategory).filter(func.lower(AiProfileCategory.name) == func.lower(name))
    if exclude_id is not None:
        q = q.filter(AiProfileCategory.id != exclude_id)

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


def _build_response_dict(obj: AiProfileCategory) -> dict[str, Any]:
    return {
        "id": int(obj.id),
        "name": obj.name,
        "isActive": bool(obj.is_active),
    }


def get_ai_profile_category(db: Session, id: int) -> dict[str, Any]:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_ai_profile_categories(db: Session, filters: AiProfileCategoryFilterRequest) -> dict[str, Any]:
    q = db.query(AiProfileCategory)

    if filters.is_active is not None:
        q = q.filter(AiProfileCategory.is_active.is_(filters.is_active))

    if filters.name:
        like = f"%{filters.name.strip()}%"
        q = q.filter(AiProfileCategory.name.like(like))

    total = q.with_entities(func.count(AiProfileCategory.id)).scalar() or 0

    items = (
        q.order_by(AiProfileCategory.name.asc(), AiProfileCategory.id.asc())
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


def create_ai_profile_category(
    db: Session,
    body: AiProfileCategoryCreateRequest,
    created_by_id: str,
) -> dict[str, Any]:
    name = body.name.strip()
    _check_unique_name(db, name, exclude_id=None)

    obj = AiProfileCategory(
        name=name,
        is_active=bool(body.is_active),
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_ai_profile_category(
    db: Session,
    id: int,
    body: AiProfileCategoryUpdateRequest,
    updated_by_id: str,
) -> dict[str, Any]:
    obj = _get_or_404(db, id)

    if body.name is not None:
        new_name = body.name.strip()
        if new_name != obj.name:
            _check_unique_name(db, new_name, exclude_id=obj.id)
        obj.name = new_name

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def change_ai_profile_category_status(
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


def delete_ai_profile_category(db: Session, id: int, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)
    db.delete(obj)
    db.commit()

# services/ai_profiles_service.py
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from models.ai_profiles import AiProfile
from schemas.ai_profiles import (
    AiProfileCreateRequest,
    AiProfileFilterRequest,
    AiProfileUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id")),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _category_ref(c) -> dict | None:
    if not c:
        return None
    return {
        "id": int(getattr(c, "id")),
        "name": getattr(c, "name", None),
    }


def _get_or_404(db: Session, profile_id: str) -> AiProfile:
    obj = (
        db.query(AiProfile)
        .options(
            joinedload(AiProfile.category),
            joinedload(AiProfile.created_by_user),
            joinedload(AiProfile.updated_by_user),
            joinedload(AiProfile.deleted_by_user),
        )
        .filter(AiProfile.id == profile_id)
        .filter(AiProfile.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_name(db: Session, name: str, exclude_id: str | None = None) -> None:
    q = db.query(AiProfile).filter(AiProfile.name == name).filter(AiProfile.deleted_at.is_(None))
    if exclude_id:
        q = q.filter(AiProfile.id != exclude_id)
    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="NAME_ALREADY_EXISTS")


def _build_response_dict(obj: AiProfile) -> dict:
    return {
        "id": str(obj.id),
        "category_id": int(obj.category_id),
        "category": _category_ref(getattr(obj, "category", None)),
        "name": obj.name,
        "description": obj.description,
        "prompt": obj.prompt,
        "is_active": bool(obj.is_active),
        "created_at": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updated_at": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,
        "created_by": _user_ref(getattr(obj, "created_by_user", None)),
        "updated_by": _user_ref(getattr(obj, "updated_by_user", None)),
        "deleted_at": obj.deleted_at.isoformat() if getattr(obj, "deleted_at", None) else None,
        "deleted_by": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def get_ai_profile(db: Session, profile_id: str) -> dict:
    obj = _get_or_404(db, profile_id)
    return _build_response_dict(obj)


def list_ai_profiles(db: Session, filters: AiProfileFilterRequest) -> dict:
    q = db.query(AiProfile).filter(AiProfile.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(AiProfile.is_active.is_(bool(filters.is_active)))

    if filters.category_id is not None:
        q = q.filter(AiProfile.category_id == int(filters.category_id))

    if filters.q:
        like = f"%{filters.q.strip()}%"
        q = q.filter(or_(AiProfile.name.like(like), AiProfile.description.like(like)))

    total = q.with_entities(func.count(AiProfile.id)).scalar() or 0

    items = (
        q.options(
            joinedload(AiProfile.category),
            joinedload(AiProfile.created_by_user),
            joinedload(AiProfile.updated_by_user),
            joinedload(AiProfile.deleted_by_user),
        )
        .order_by(AiProfile.name.asc())
        .offset(int(filters.skip))
        .limit(int(filters.limit))
        .all()
    )

    return {
        "items": [_build_response_dict(x) for x in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def create_ai_profile(db: Session, body: AiProfileCreateRequest, created_by_id: str) -> dict:
    _check_unique_name(db, body.name)

    obj = AiProfile(
        id=str(uuid.uuid4()),
        category_id=int(body.category_id),
        name=body.name,
        description=body.description,
        prompt=body.prompt,
        is_active=bool(body.is_active),
        created_by=str(created_by_id) if created_by_id else None,
        updated_by=None,
        deleted_at=None,
        deleted_by=None,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_ai_profile(db: Session, profile_id: str, body: AiProfileUpdateRequest, updated_by_id: str) -> dict:
    obj = _get_or_404(db, profile_id)

    if body.name is not None and body.name != obj.name:
        _check_unique_name(db, body.name, exclude_id=obj.id)
        obj.name = body.name

    if body.category_id is not None:
        obj.category_id = int(body.category_id)

    if body.description is not None:
        obj.description = body.description

    if body.prompt is not None:
        obj.prompt = body.prompt

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = str(updated_by_id) if updated_by_id else None

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def change_ai_profile_status(db: Session, profile_id: str, is_active: bool, updated_by_id: str) -> dict:
    obj = _get_or_404(db, profile_id)

    obj.is_active = bool(is_active)
    obj.updated_by = str(updated_by_id) if updated_by_id else None

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_ai_profile(db: Session, profile_id: str, deleted_by_id: str) -> None:
    obj = _get_or_404(db, profile_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = str(deleted_by_id) if deleted_by_id else None
    obj.is_active = False
    obj.updated_by = str(deleted_by_id) if deleted_by_id else None

    db.commit()

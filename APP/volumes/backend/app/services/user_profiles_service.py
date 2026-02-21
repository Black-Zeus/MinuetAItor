# services/user_profiles_service.py
from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.user_profiles import UserProfile
from schemas.user_profiles import UserProfileCreateRequest, UserProfileFilterRequest, UserProfileUpdateRequest


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _get_or_404(db: Session, user_id: str) -> UserProfile:
    obj = (
        db.query(UserProfile)
        .options(joinedload(UserProfile.user))
        .filter(UserProfile.user_id == user_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _build_response_dict(obj: UserProfile) -> dict[str, Any]:
    return {
        "user_id": str(obj.user_id),
        "initials": obj.initials,
        "color": obj.color,
        "position": obj.position,
        "department": obj.department,
        "notes": obj.notes,
        "last_activity": str(obj.last_activity) if obj.last_activity else None,
        "user": _user_ref(obj.user),
    }


def get_user_profile(db: Session, user_id: str) -> dict[str, Any]:
    obj = _get_or_404(db, user_id)
    return _build_response_dict(obj)


def list_user_profiles(db: Session, filters: UserProfileFilterRequest) -> dict[str, Any]:
    q = db.query(UserProfile)

    if filters.user_id:
        q = q.filter(UserProfile.user_id == filters.user_id)

    if filters.department:
        q = q.filter(UserProfile.department == filters.department)

    if filters.position:
        q = q.filter(UserProfile.position == filters.position)

    if filters.initials:
        q = q.filter(UserProfile.initials == filters.initials)

    if filters.last_activity_from:
        q = q.filter(UserProfile.last_activity >= filters.last_activity_from)

    if filters.last_activity_to:
        q = q.filter(UserProfile.last_activity <= filters.last_activity_to)

    total = q.with_entities(func.count(UserProfile.user_id)).scalar() or 0

    items = (
        q.options(joinedload(UserProfile.user))
        .order_by(UserProfile.user_id.asc())
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


def create_user_profile(db: Session, body: UserProfileCreateRequest) -> dict[str, Any]:
    # PK = user_id, debe venir desde el cliente (ya existe el user)
    exists = db.query(UserProfile).filter(UserProfile.user_id == body.user_id).first()
    if exists:
        raise HTTPException(status_code=409, detail="USER_PROFILE_ALREADY_EXISTS")

    obj = UserProfile(
        user_id=body.user_id,
        initials=body.initials,
        color=body.color,
        position=body.position,
        department=body.department,
        notes=body.notes,
        last_activity=body.last_activity if isinstance(body.last_activity, date) else body.last_activity,
    )

    db.add(obj)
    db.commit()
    obj = _get_or_404(db, obj.user_id)
    return _build_response_dict(obj)


def update_user_profile(db: Session, user_id: str, body: UserProfileUpdateRequest) -> dict[str, Any]:
    obj = _get_or_404(db, user_id)

    if body.initials is not None:
        obj.initials = body.initials
    if body.color is not None:
        obj.color = body.color
    if body.position is not None:
        obj.position = body.position
    if body.department is not None:
        obj.department = body.department
    if body.notes is not None:
        obj.notes = body.notes
    if body.last_activity is not None:
        obj.last_activity = body.last_activity

    db.commit()
    obj = _get_or_404(db, obj.user_id)
    return _build_response_dict(obj)


def delete_user_profile(db: Session, user_id: str) -> None:
    obj = _get_or_404(db, user_id)
    db.delete(obj)
    db.commit()
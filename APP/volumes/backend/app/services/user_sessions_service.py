# services/user_sessions_service.py
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.user_sessions import UserSession
from schemas.user_sessions import (
    UserSessionsCreateRequest,
    UserSessionsFilterRequest,
    UserSessionsUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id")),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: UserSession) -> dict:
    return {
        "id": str(obj.id),
        "userId": str(obj.user_id),
        "jti": obj.jti,
        "ipV4": obj.ip_v4,
        "ipV6": obj.ip_v6,
        "userAgent": obj.user_agent,
        "device": obj.device,
        "countryCode": obj.country_code,
        "countryName": obj.country_name,
        "city": obj.city,
        "location": obj.location,
        "loggedOutAt": obj.logged_out_at.isoformat() if obj.logged_out_at else None,
        "createdAt": obj.created_at.isoformat() if obj.created_at else None,
        "user": _user_ref(getattr(obj, "user", None)),
    }


def _get_or_404(db: Session, id: str) -> UserSession:
    obj = (
        db.query(UserSession)
        .options(joinedload(UserSession.user))
        .filter(UserSession.id == id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="USER_SESSION_NOT_FOUND")
    return obj


def _check_unique_jti(db: Session, jti: str, exclude_id: str | None = None) -> None:
    q = db.query(UserSession).filter(UserSession.jti == jti)
    if exclude_id:
        q = q.filter(UserSession.id != exclude_id)
    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="JTI_ALREADY_EXISTS")


def get_user_session(db: Session, id: str) -> dict:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_user_sessions(db: Session, filters: UserSessionsFilterRequest) -> dict:
    q = db.query(UserSession)

    if filters.user_id:
        q = q.filter(UserSession.user_id == filters.user_id)

    if filters.jti:
        q = q.filter(UserSession.jti == filters.jti)

    if filters.country_code:
        q = q.filter(UserSession.country_code == filters.country_code)

    if filters.is_logged_out is True:
        q = q.filter(UserSession.logged_out_at.isnot(None))
    elif filters.is_logged_out is False:
        q = q.filter(UserSession.logged_out_at.is_(None))

    total = q.with_entities(func.count(UserSession.id)).scalar() or 0

    items = (
        q.options(joinedload(UserSession.user))
        .order_by(UserSession.created_at.desc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(it) for it in items],
        "total": int(total),
        "skip": filters.skip,
        "limit": filters.limit,
    }


def create_user_session(db: Session, body: UserSessionsCreateRequest) -> dict:
    _check_unique_jti(db, body.jti)

    obj = UserSession(
        id=str(uuid.uuid4()),
        user_id=body.user_id,
        jti=body.jti,
        ip_v4=body.ip_v4,
        ip_v6=body.ip_v6,
        user_agent=body.user_agent,
        device=body.device,
        country_code=body.country_code,
        country_name=body.country_name,
        city=body.city,
        location=body.location,
        logged_out_at=body.logged_out_at,
        created_at=datetime.utcnow(),
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_user_session(db: Session, id: str, body: UserSessionsUpdateRequest) -> dict:
    obj = _get_or_404(db, id)

    if body.ip_v4 is not None:
        obj.ip_v4 = body.ip_v4
    if body.ip_v6 is not None:
        obj.ip_v6 = body.ip_v6
    if body.user_agent is not None:
        obj.user_agent = body.user_agent
    if body.device is not None:
        obj.device = body.device

    if body.country_code is not None:
        obj.country_code = body.country_code
    if body.country_name is not None:
        obj.country_name = body.country_name
    if body.city is not None:
        obj.city = body.city
    if body.location is not None:
        obj.location = body.location

    if body.logged_out_at is not None:
        obj.logged_out_at = body.logged_out_at

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_user_session(db: Session, id: str) -> None:
    obj = _get_or_404(db, id)
    db.delete(obj)
    db.commit()
# services/user_clients_service.py
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.user_clients import UserClient
from schemas.user_clients import (
    UserClientCreateRequest,
    UserClientFilterRequest,
    UserClientUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: UserClient) -> dict[str, Any]:
    return {
        "user_id": str(obj.user_id),
        "client_id": str(obj.client_id),
        "is_active": bool(obj.is_active),

        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,

        "created_by": _user_ref(obj.created_by_user),
        "updated_by": _user_ref(obj.updated_by_user),
        "deleted_by": _user_ref(obj.deleted_by_user),
    }


def _get_or_404(db: Session, user_id: str, client_id: str) -> UserClient:
    q = (
        db.query(UserClient)
        .options(
            joinedload(UserClient.user),
            joinedload(UserClient.client),
            joinedload(UserClient.created_by_user),
            joinedload(UserClient.updated_by_user),
            joinedload(UserClient.deleted_by_user),
        )
        .filter(
            UserClient.user_id == user_id,
            UserClient.client_id == client_id,
            UserClient.deleted_at.is_(None),
        )
    )
    obj = q.first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def get_user_client(db: Session, user_id: str, client_id: str) -> dict[str, Any]:
    obj = _get_or_404(db, user_id, client_id)
    return _build_response_dict(obj)


def list_user_clients(db: Session, filters: UserClientFilterRequest) -> dict[str, Any]:
    q = db.query(UserClient).filter(UserClient.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(UserClient.is_active == filters.is_active)

    if filters.user_id:
        q = q.filter(UserClient.user_id == filters.user_id)

    if filters.client_id:
        q = q.filter(UserClient.client_id == filters.client_id)

    total = q.with_entities(func.count(UserClient.user_id)).scalar() or 0

    items = (
        q.options(
            joinedload(UserClient.user),
            joinedload(UserClient.client),
            joinedload(UserClient.created_by_user),
            joinedload(UserClient.updated_by_user),
            joinedload(UserClient.deleted_by_user),
        )
        .order_by(UserClient.created_at.desc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(x) for x in items],
        "total": int(total),
        "skip": filters.skip,
        "limit": filters.limit,
    }


def create_user_client(db: Session, body: UserClientCreateRequest, created_by_id: str) -> dict[str, Any]:
    # Buscar existente incluso si está soft-deleted (para permitir "restore")
    existing = (
        db.query(UserClient)
        .filter(UserClient.user_id == body.user_id, UserClient.client_id == body.client_id)
        .first()
    )

    if existing and existing.deleted_at is None:
        raise HTTPException(status_code=409, detail="RELATION_ALREADY_EXISTS")

    if existing and existing.deleted_at is not None:
        existing.deleted_at = None
        existing.deleted_by = None
        existing.is_active = bool(body.is_active)
        existing.updated_by = created_by_id
        db.commit()
        obj = _get_or_404(db, existing.user_id, existing.client_id)
        return _build_response_dict(obj)

    obj = UserClient(
        user_id=body.user_id,
        client_id=body.client_id,
        is_active=bool(body.is_active),
        created_by=created_by_id,
        updated_by=None,
        deleted_at=None,
        deleted_by=None,
    )

    db.add(obj)
    db.commit()
    obj = _get_or_404(db, obj.user_id, obj.client_id)
    return _build_response_dict(obj)


def update_user_client(
    db: Session,
    user_id: str,
    client_id: str,
    body: UserClientUpdateRequest,
    updated_by_id: str,
) -> dict[str, Any]:
    obj = _get_or_404(db, user_id, client_id)

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.commit()
    obj = _get_or_404(db, user_id, client_id)
    return _build_response_dict(obj)


def change_user_client_status(db: Session, user_id: str, client_id: str, is_active: bool, updated_by_id: str) -> dict[str, Any]:
    obj = _get_or_404(db, user_id, client_id)
    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    obj = _get_or_404(db, user_id, client_id)
    return _build_response_dict(obj)


def delete_user_client(db: Session, user_id: str, client_id: str, deleted_by_id: str) -> None:
    obj = _get_or_404(db, user_id, client_id)
    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False

    db.commit()
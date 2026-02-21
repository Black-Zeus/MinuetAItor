# services/clients_service.py
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.clients import Client
from schemas.clients import ClientCreateRequest, ClientFilterRequest, ClientUpdateRequest


def _get_or_404(db: Session, client_id: str) -> Client:
    q = (
        db.query(Client)
        .options(
            joinedload(Client.created_by_user),
            joinedload(Client.updated_by_user),
            joinedload(Client.deleted_by_user),
        )
        .filter(Client.id == client_id, Client.deleted_at.is_(None))
    )
    obj = q.first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_name(db: Session, name: str, exclude_id: Optional[str] = None) -> None:
    q = db.query(Client).filter(Client.name == name, Client.deleted_at.is_(None))
    if exclude_id:
        q = q.filter(Client.id != exclude_id)
    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="NAME_ALREADY_EXISTS")


def _check_unique_code(db: Session, code: Optional[str], exclude_id: Optional[str] = None) -> None:
    if not code:
        return
    q = db.query(Client).filter(Client.code == code, Client.deleted_at.is_(None))
    if exclude_id:
        q = q.filter(Client.id != exclude_id)
    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="CODE_ALREADY_EXISTS")


def _user_ref(u) -> Optional[dict]:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: Client) -> dict:
    return {
        "id": str(obj.id),
        "name": obj.name,
        "code": obj.code,
        "description": obj.description,
        "industry": obj.industry,
        "is_confidential": bool(obj.is_confidential),
        "is_active": bool(obj.is_active),
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "created_by": _user_ref(obj.created_by_user),
        "updated_by": _user_ref(obj.updated_by_user),
        "deleted_by": _user_ref(obj.deleted_by_user),
    }


def get_client(db: Session, client_id: str) -> dict:
    obj = _get_or_404(db, client_id)
    return _build_response_dict(obj)


def list_clients(db: Session, filters: ClientFilterRequest) -> dict:
    q = db.query(Client).filter(Client.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(Client.is_active == bool(filters.is_active))

    if filters.is_confidential is not None:
        q = q.filter(Client.is_confidential == bool(filters.is_confidential))

    if filters.name:
        q = q.filter(Client.name.ilike(f"%{filters.name}%"))

    if filters.code:
        q = q.filter(Client.code.ilike(f"%{filters.code}%"))

    if filters.industry:
        q = q.filter(Client.industry.ilike(f"%{filters.industry}%"))

    total = q.with_entities(func.count(Client.id)).scalar() or 0

    items = (
        q.options(
            joinedload(Client.created_by_user),
            joinedload(Client.updated_by_user),
            joinedload(Client.deleted_by_user),
        )
        .order_by(Client.name.asc())
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


def create_client(db: Session, payload: ClientCreateRequest, created_by_id: str) -> dict:
    _check_unique_name(db, payload.name)
    _check_unique_code(db, payload.code)

    obj = Client(
        id=str(uuid.uuid4()),
        name=payload.name,
        code=payload.code,
        description=payload.description,
        industry=payload.industry,
        is_confidential=bool(payload.is_confidential),
        is_active=bool(payload.is_active),
        created_by=created_by_id,
        updated_by=None,
        deleted_at=None,
        deleted_by=None,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = (
        db.query(Client)
        .options(
            joinedload(Client.created_by_user),
            joinedload(Client.updated_by_user),
            joinedload(Client.deleted_by_user),
        )
        .filter(Client.id == obj.id)
        .first()
    )

    return _build_response_dict(obj)


def update_client(db: Session, client_id: str, payload: ClientUpdateRequest, updated_by_id: str) -> dict:
    obj = _get_or_404(db, client_id)

    if "name" in payload.model_fields_set and payload.name is not None:
        if payload.name != obj.name:
            _check_unique_name(db, payload.name, exclude_id=obj.id)

    if "code" in payload.model_fields_set:
        if payload.code != obj.code:
            _check_unique_code(db, payload.code, exclude_id=obj.id)

    if "name" in payload.model_fields_set and payload.name is not None:
        obj.name = payload.name

    if "code" in payload.model_fields_set:
        obj.code = payload.code

    if "description" in payload.model_fields_set:
        obj.description = payload.description

    if "industry" in payload.model_fields_set:
        obj.industry = payload.industry

    if "is_confidential" in payload.model_fields_set and payload.is_confidential is not None:
        obj.is_confidential = bool(payload.is_confidential)

    if "is_active" in payload.model_fields_set and payload.is_active is not None:
        obj.is_active = bool(payload.is_active)

    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = (
        db.query(Client)
        .options(
            joinedload(Client.created_by_user),
            joinedload(Client.updated_by_user),
            joinedload(Client.deleted_by_user),
        )
        .filter(Client.id == obj.id)
        .first()
    )

    return _build_response_dict(obj)


def change_client_status(db: Session, client_id: str, is_active: bool, updated_by_id: str) -> dict:
    obj = _get_or_404(db, client_id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = (
        db.query(Client)
        .options(
            joinedload(Client.created_by_user),
            joinedload(Client.updated_by_user),
            joinedload(Client.deleted_by_user),
        )
        .filter(Client.id == obj.id)
        .first()
    )

    return _build_response_dict(obj)


def delete_client(db: Session, client_id: str, deleted_by_id: str) -> None:
    obj = _get_or_404(db, client_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False

    db.commit()

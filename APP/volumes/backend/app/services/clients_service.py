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

from utils.text import title_case_es

def _get_or_404(db: Session, client_id: str) -> Client:
    obj = (
        db.query(Client)
        .options(
            joinedload(Client.created_by_user),
            joinedload(Client.updated_by_user),
            joinedload(Client.deleted_by_user),
        )
        .filter(Client.id == client_id, Client.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_name(db: Session, name: str, exclude_id: Optional[str] = None) -> None:
    q = db.query(Client).filter(Client.name == name, Client.deleted_at.is_(None))
    if exclude_id:
        q = q.filter(Client.id != exclude_id)
    if db.query(q.exists()).scalar():
        raise HTTPException(status_code=409, detail="NAME_ALREADY_EXISTS")


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
        # Empresa
        "name":        obj.name,
        "legal_name":  obj.legal_name,
        "description": obj.description,
        "industry":    obj.industry,
        "email":       obj.email,
        "phone":       obj.phone,
        "website":     obj.website,
        "address":     obj.address,
        # Contacto
        "contact_name":       obj.contact_name,
        "contact_email":      obj.contact_email,
        "contact_phone":      obj.contact_phone,
        "contact_position":   obj.contact_position,
        "contact_department": obj.contact_department,
        # Clasificación
        "status":   obj.status,
        "priority": obj.priority,
        # Contenido libre
        "notes": obj.notes,
        "tags":  obj.tags,
        # Gobernanza
        "is_confidential": bool(obj.is_confidential),
        "is_active":       bool(obj.is_active),
        # Auditoría
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "created_by": _user_ref(obj.created_by_user),
        "updated_by": _user_ref(obj.updated_by_user),
        "deleted_by": _user_ref(obj.deleted_by_user),
    }


def _reload_with_relations(db: Session, client_id: str) -> Client:
    return (
        db.query(Client)
        .options(
            joinedload(Client.created_by_user),
            joinedload(Client.updated_by_user),
            joinedload(Client.deleted_by_user),
        )
        .filter(Client.id == client_id)
        .first()
    )


def get_client(db: Session, client_id: str) -> dict:
    return _build_response_dict(_get_or_404(db, client_id))


def list_clients(db: Session, filters: ClientFilterRequest) -> dict:
    q = db.query(Client).filter(Client.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(Client.is_active == bool(filters.is_active))
    if filters.is_confidential is not None:
        q = q.filter(Client.is_confidential == bool(filters.is_confidential))
    if filters.name:
        q = q.filter(Client.name.ilike(f"%{filters.name}%"))
    if filters.industry:
        q = q.filter(Client.industry.ilike(f"%{filters.industry}%"))
    if filters.status:
        q = q.filter(Client.status == filters.status)
    if filters.priority:
        q = q.filter(Client.priority == filters.priority)

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
        "skip":  int(filters.skip),
        "limit": int(filters.limit),
    }


def create_client(db: Session, payload: ClientCreateRequest, created_by_id: str) -> dict:
    _check_unique_name(db, payload.name)

    obj = Client(
        id=str(uuid.uuid4()),
        # Empresa
        name=payload.name,
        legal_name=payload.legal_name,
        description=payload.description,
        industry=payload.industry,
        email=payload.email,
        phone=payload.phone,
        website=payload.website,
        address=payload.address,
        # Contacto
        contact_name=payload.contact_name,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        contact_position=payload.contact_position,
        contact_department=payload.contact_department,
        # Clasificación
        status=payload.status or "activo",
        priority=payload.priority or "media",
        # Contenido libre
        notes=payload.notes,
        tags=payload.tags,
        # Gobernanza
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
    return _build_response_dict(_reload_with_relations(db, obj.id))


# Campos actualizables mapeados a atributos del modelo
_UPDATABLE_FIELDS = [
    "name", "legal_name", "description", "industry",
    "email", "phone", "website", "address",
    "contact_name", "contact_email", "contact_phone",
    "contact_position", "contact_department",
    "status", "priority", "notes", "tags",
    "is_confidential", "is_active",
]


def update_client(db: Session, client_id: str, payload: ClientUpdateRequest, updated_by_id: str) -> dict:
    obj = _get_or_404(db, client_id)

    for field in _UPDATABLE_FIELDS:
        if field not in payload.model_fields_set:
            continue
        value = getattr(payload, field)
        # Validación especial: name único
        if field == "name" and value is not None and value != obj.name:
            _check_unique_name(db, value, exclude_id=obj.id)
        # Castear booleanos explícitamente
        if field in ("is_confidential", "is_active") and value is not None:
            value = bool(value)
        setattr(obj, field, value)

    obj.updated_by = updated_by_id
    db.commit()
    db.refresh(obj)
    return _build_response_dict(_reload_with_relations(db, obj.id))


def change_client_status(db: Session, client_id: str, is_active: bool, updated_by_id: str) -> dict:
    obj = _get_or_404(db, client_id)
    obj.is_active  = bool(is_active)
    obj.updated_by = updated_by_id
    db.commit()
    db.refresh(obj)
    return _build_response_dict(_reload_with_relations(db, obj.id))


def delete_client(db: Session, client_id: str, deleted_by_id: str) -> None:
    obj = _get_or_404(db, client_id)
    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active  = False
    db.commit()

def list_industries(db: Session) -> list[str]:
    """
    Devuelve todas las industrias distintas presentes en clients,
    sin filtrar por estado, normalizadas a title case español.
    """
    rows = (
        db.query(Client.industry)
        .filter(Client.industry.isnot(None), Client.industry != "")
        .distinct()
        .order_by(Client.industry.asc())
        .all()
    )
    return sorted(
        {title_case_es(row.industry) for row in rows}
    )
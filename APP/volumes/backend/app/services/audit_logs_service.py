# services/audit_logs_service.py
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.audit_logs import AuditLog


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _get_or_404(db: Session, id: int) -> AuditLog:
    obj = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.actor_user))
        .filter(AuditLog.id == id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _build_response_dict(obj: AuditLog) -> dict[str, Any]:
    return {
        "id": int(obj.id),
        "eventAt": obj.event_at.isoformat() if getattr(obj, "event_at", None) else None,
        "actorUserId": str(obj.actor_user_id),
        "actorUser": _user_ref(getattr(obj, "actor_user", None)),
        "action": str(obj.action),
        "entityType": str(obj.entity_type),
        "entityId": str(obj.entity_id) if obj.entity_id else None,
        "detailsJson": str(obj.details_json) if obj.details_json is not None else None,
    }


def get_audit_log(db: Session, id: int) -> dict[str, Any]:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_audit_logs(db: Session, filters) -> dict[str, Any]:
    q = db.query(AuditLog)

    if getattr(filters, "actor_user_id", None):
        q = q.filter(AuditLog.actor_user_id == filters.actor_user_id)

    if getattr(filters, "action", None):
        q = q.filter(AuditLog.action == filters.action)

    if getattr(filters, "entity_type", None):
        q = q.filter(AuditLog.entity_type == filters.entity_type)

    if getattr(filters, "entity_id", None):
        q = q.filter(AuditLog.entity_id == filters.entity_id)

    if getattr(filters, "event_from", None):
        q = q.filter(AuditLog.event_at >= filters.event_from)

    if getattr(filters, "event_to", None):
        q = q.filter(AuditLog.event_at <= filters.event_to)

    total = q.with_entities(func.count(AuditLog.id)).scalar() or 0

    items = (
        q.options(joinedload(AuditLog.actor_user))
        .order_by(AuditLog.event_at.desc(), AuditLog.id.desc())
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


def create_audit_log(db: Session, body, created_by_id: str) -> dict[str, Any]:
    # En audit_log el "actor_user_id" viene del request (o podría imponerse con session.user_id).
    # Aquí se respeta el request, pero típicamente podrías forzarlo = created_by_id.
    obj = AuditLog(
        actor_user_id=body.actor_user_id,
        action=body.action,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        details_json=body.details_json,
    )

    if body.event_at is not None:
        obj.event_at = body.event_at

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, int(obj.id))
    return _build_response_dict(obj)


def update_audit_log(db: Session, id: int, body, updated_by_id: str) -> dict[str, Any]:
    obj = _get_or_404(db, id)

    if body.actor_user_id is not None:
        obj.actor_user_id = body.actor_user_id
    if body.action is not None:
        obj.action = body.action
    if body.entity_type is not None:
        obj.entity_type = body.entity_type
    if body.entity_id is not None:
        obj.entity_id = body.entity_id
    if body.details_json is not None:
        obj.details_json = body.details_json
    if body.event_at is not None:
        obj.event_at = body.event_at

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, int(obj.id))
    return _build_response_dict(obj)


def delete_audit_log(db: Session, id: int) -> None:
    obj = _get_or_404(db, id)
    db.delete(obj)
    db.commit()
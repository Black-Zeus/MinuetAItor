# services/audit_logs_service.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.audit_logs import AuditLog


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id":        str(getattr(u, "id", None)),
        "username":  getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _get_or_404(db: Session, id: int) -> AuditLog:
    obj = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.actor))
        .filter(AuditLog.id == id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="AUDIT_LOG_NOT_FOUND")
    return obj


def _build_response_dict(obj: AuditLog) -> dict[str, Any]:
    return {
        "id":           int(obj.id),
        "eventAt":      obj.event_at.isoformat() if getattr(obj, "event_at", None) else None,
        "actorUserId":  str(obj.actor_user_id),
        "actorUser":    _user_ref(getattr(obj, "actor", None)),
        "action":       str(obj.action),
        "entityType":   str(obj.entity_type),
        "entityId":     str(obj.entity_id) if obj.entity_id else None,
        "detailsJson":  str(obj.details_json) if obj.details_json is not None else None,
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
        q.options(joinedload(AuditLog.actor))
        .order_by(AuditLog.event_at.desc(), AuditLog.id.desc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(i) for i in items],
        "total": int(total),
        "skip":  int(filters.skip),
        "limit": int(filters.limit),
    }


def create_audit_log(db: Session, body, created_by_id: str) -> dict[str, Any]:
    """
    Crea un registro de auditoría.
    actor_user_id se toma del body (puede ser cualquier actor registrado),
    pero event_at se fuerza a now() si no viene en el body.
    Los registros de auditoría son inmutables: no existe update ni delete.
    """
    obj = AuditLog(
        actor_user_id = body.actor_user_id,
        action        = body.action,
        entity_type   = body.entity_type,
        entity_id     = body.entity_id,
        details_json  = body.details_json,
        event_at      = body.event_at or datetime.now(timezone.utc),
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return _build_response_dict(_get_or_404(db, int(obj.id)))


# update_audit_log eliminado — registro inmutable.
# delete_audit_log eliminado — los logs de auditoría no se eliminan.
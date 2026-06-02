from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from core.datetime_utils import utc_now_db
from models.system_events import SystemEvent
from models.user import User


def _actor_snapshot(db: Session, actor_user_id: str | None) -> dict[str, Any] | None:
    if not actor_user_id:
        return None
    user = db.query(User).filter(User.id == actor_user_id).first()
    if not user:
        return {"id": str(actor_user_id)}
    return {
        "id": str(user.id),
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
    }


def write_system_event(
    db: Session,
    *,
    domain: str,
    event_type: str,
    subject: str,
    detail: str | None = None,
    severity: str = "info",
    status: str = "success",
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor_user_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> SystemEvent:
    event = SystemEvent(
        event_at=utc_now_db(),
        domain=str(domain or "system").strip() or "system",
        event_type=str(event_type or "system_event").strip() or "system_event",
        severity=str(severity or "info").strip() or "info",
        status=str(status or "success").strip() or "success",
        subject=str(subject or "Evento de sistema").strip()[:255] or "Evento de sistema",
        detail=(str(detail).strip()[:700] if detail else None),
        entity_type=str(entity_type).strip()[:80] if entity_type else None,
        entity_id=str(entity_id).strip()[:80] if entity_id else None,
        actor_user_id=actor_user_id,
        actor_snapshot_json=json.dumps(_actor_snapshot(db, actor_user_id), ensure_ascii=False, sort_keys=True)
        if actor_user_id else None,
        metadata_json=json.dumps(metadata, ensure_ascii=False, sort_keys=True) if metadata else None,
    )
    db.add(event)
    db.commit()
    return event

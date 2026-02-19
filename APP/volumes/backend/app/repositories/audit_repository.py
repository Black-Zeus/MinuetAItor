# repositories/audit_repository.py
import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from models.audit_log import AuditLog


def write_audit(
    db: Session,
    *,
    actor_user_id: str,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    details: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        event_at      = datetime.now(timezone.utc),
        actor_user_id = actor_user_id,
        action        = action,
        entity_type   = entity_type,
        entity_id     = entity_id,
        details_json  = json.dumps(details) if details else None,
    )
    db.add(entry)
    db.commit()
    return entry
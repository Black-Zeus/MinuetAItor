# repositories/audit_repository.py
import json

from sqlalchemy.orm import Session

from core.datetime_utils import utc_now_db
from models.audit_logs import AuditLog


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
        event_at      = utc_now_db(),
        actor_user_id = actor_user_id,
        action        = action,
        entity_type   = entity_type,
        entity_id     = entity_id,
        details_json  = json.dumps(details) if details else None,
    )
    db.add(entry)
    db.commit()
    return entry

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from models.record_status_transitions import RecordStatusTransition


def append_record_status_transition(
    db: Session,
    *,
    record_id: str,
    from_status_id: int | None,
    to_status_id: int,
    changed_by: str | None,
    source: str,
    transition_reason: str | None = None,
    minute_transaction_id: str | None = None,
    record_version_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> RecordStatusTransition | None:
    if from_status_id == to_status_id:
        return None

    transition = RecordStatusTransition(
        record_id=record_id,
        minute_transaction_id=minute_transaction_id,
        record_version_id=record_version_id,
        from_status_id=from_status_id,
        to_status_id=to_status_id,
        changed_by=changed_by,
        source=source,
        transition_reason=transition_reason,
        metadata_json=metadata or None,
    )
    db.add(transition)
    return transition

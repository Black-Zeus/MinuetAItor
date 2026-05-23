from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from models.record_version_agreements import RecordVersionAgreement
from models.record_version_requirements import RecordVersionRequirement


def _clean(value: Any, fallback: str | None = None) -> str | None:
    if value is None:
        return fallback
    raw = str(value).strip()
    return raw or fallback


def _as_list(value: Any) -> list[dict]:
    if isinstance(value, dict):
        value = value.get("items")
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    raw = str(value).strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def _agreement_code(item: dict, index: int) -> str:
    return _clean(item.get("agreementId") or item.get("agreement_id"), f"AGR-{index:03d}") or f"AGR-{index:03d}"


def _requirement_code(item: dict, index: int) -> str:
    return _clean(item.get("requirementId") or item.get("requirement_id"), f"REQ-{index:03d}") or f"REQ-{index:03d}"


def sync_record_version_commitment_items(
    db: Session,
    *,
    record_id: str,
    record_version_id: str,
    content: dict[str, Any] | None,
) -> None:
    """Replace derived agreement/requirement rows for a version.

    The editor and AI payloads both keep these sections in JSON. Reports query
    relational tables, so each immutable version gets a fresh projection.
    """
    db.query(RecordVersionAgreement).filter(
        RecordVersionAgreement.record_version_id == record_version_id
    ).delete(synchronize_session=False)
    db.query(RecordVersionRequirement).filter(
        RecordVersionRequirement.record_version_id == record_version_id
    ).delete(synchronize_session=False)

    if not isinstance(content, dict):
        return

    for index, item in enumerate(_as_list(content.get("agreements")), start=1):
        db.add(
            RecordVersionAgreement(
                record_id=record_id,
                record_version_id=record_version_id,
                agreement_code=_agreement_code(item, index),
                subject=_clean(item.get("subject"), "Acuerdo sin asunto"),
                body=_clean(item.get("body"), ""),
                responsible=_clean(item.get("responsible")),
                due_date=_parse_date(item.get("dueDate") or item.get("due_date")),
                status=_clean(item.get("status"), "pending"),
                source_index=index,
            )
        )

    for index, item in enumerate(_as_list(content.get("requirements")), start=1):
        body = _clean(item.get("body"), "Requerimiento sin detalle")
        db.add(
            RecordVersionRequirement(
                record_id=record_id,
                record_version_id=record_version_id,
                requirement_code=_requirement_code(item, index),
                entity=_clean(item.get("entity")),
                body=body,
                responsible=_clean(item.get("responsible")),
                priority=_clean(item.get("priority"), "medium"),
                status=_clean(item.get("status"), "open"),
                source_index=index,
            )
        )

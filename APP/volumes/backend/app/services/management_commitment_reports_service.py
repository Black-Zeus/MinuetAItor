from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.clients import Client
from models.projects import Project
from models.record_version_agreements import RecordVersionAgreement
from models.record_version_requirements import RecordVersionRequirement
from models.records import Record
from models.record_versions import RecordVersion


def _activity_date_expr():
    return func.coalesce(Record.document_date, func.date(RecordVersion.published_at))


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


def _base_row(record: Record, client: Client, project: Project | None, version: RecordVersion) -> dict:
    return {
        "record_id": str(record.id),
        "record_version_id": str(version.id) if version else None,
        "minute_title": record.title or "Minuta sin título",
        "client": client.name if client else "Sin cliente",
        "project": project.name if project else "Sin proyecto",
        "date": record.document_date or _parse_date(getattr(version, "published_at", None)),
    }


def _clean_text(value: str | None, fallback: str) -> str:
    raw = (value or "").strip()
    return raw or fallback


def list_management_commitment_items(db: Session, filters) -> dict:
    date_expr = _activity_date_expr()

    agreement_q = (
        db.query(RecordVersionAgreement, Record, Client, Project, RecordVersion)
        .join(Record, Record.id == RecordVersionAgreement.record_id)
        .join(RecordVersion, RecordVersion.id == RecordVersionAgreement.record_version_id)
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
        .filter(Record.deleted_at.is_(None))
        .filter(Record.active_version_id == RecordVersionAgreement.record_version_id)
    )

    requirement_q = (
        db.query(RecordVersionRequirement, Record, Client, Project, RecordVersion)
        .join(Record, Record.id == RecordVersionRequirement.record_id)
        .join(RecordVersion, RecordVersion.id == RecordVersionRequirement.record_version_id)
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
        .filter(Record.deleted_at.is_(None))
        .filter(Record.active_version_id == RecordVersionRequirement.record_version_id)
    )

    if filters.date_from:
        agreement_q = agreement_q.filter(date_expr >= filters.date_from)
        requirement_q = requirement_q.filter(date_expr >= filters.date_from)
    if filters.date_to:
        agreement_q = agreement_q.filter(date_expr <= filters.date_to)
        requirement_q = requirement_q.filter(date_expr <= filters.date_to)
    if filters.client:
        agreement_q = agreement_q.filter(Client.name == filters.client)
        requirement_q = requirement_q.filter(Client.name == filters.client)
    if filters.project:
        agreement_q = agreement_q.filter(Project.name == filters.project)
        requirement_q = requirement_q.filter(Project.name == filters.project)

    items: list[dict] = []

    for agreement, record, client, project, version in agreement_q.all():
        base = _base_row(record, client, project, version)
        items.append(
            {
                **base,
                "id": f"{agreement.record_version_id}-agreement-{agreement.id}",
                "item_type": "agreement",
                "item_code": agreement.agreement_code,
                "title": _clean_text(agreement.subject, "Acuerdo sin asunto"),
                "body": _clean_text(agreement.body, ""),
                "responsible": _clean_text(agreement.responsible, "Sin responsable"),
                "status": _clean_text(agreement.status, "pending"),
                "priority": None,
                "due_date": agreement.due_date,
                "entity": None,
                "source_index": agreement.source_index,
            }
        )

    for requirement, record, client, project, version in requirement_q.all():
        base = _base_row(record, client, project, version)
        body = _clean_text(requirement.body, "Requerimiento sin detalle")
        items.append(
            {
                **base,
                "id": f"{requirement.record_version_id}-requirement-{requirement.id}",
                "item_type": "requirement",
                "item_code": requirement.requirement_code,
                "title": body[:120],
                "body": body,
                "responsible": _clean_text(requirement.responsible, "Sin responsable"),
                "status": _clean_text(requirement.status, "open"),
                "priority": _clean_text(requirement.priority, "medium"),
                "due_date": None,
                "entity": (requirement.entity or "").strip() or None,
                "source_index": requirement.source_index,
            }
        )

    items.sort(
        key=lambda row: (
            -(row["date"].toordinal() if row["date"] else date.min.toordinal()),
            row["minute_title"],
            row["item_type"],
            row.get("source_index") or 0,
        )
    )
    for row in items:
        row.pop("source_index", None)

    return {
        "items": items[: filters.limit],
        "total": len(items),
    }

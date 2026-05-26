from __future__ import annotations

import json
from datetime import datetime, time
from typing import Any

from sqlalchemy.orm import Session

from models.clients import Client
from models.email_delivery_events import EmailDeliveryEvent
from models.projects import Project
from models.records import Record
from schemas.auth import UserSession
from services.access_control_service import apply_record_scope_filter, is_admin


def _json_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item or "").strip()]
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item).strip() for item in parsed if str(item or "").strip()]


def _clean(value: Any, fallback: str = "") -> str:
    raw = str(value or "").strip()
    return raw or fallback


def list_management_email_deliveries(db: Session, session: UserSession, filters) -> dict:
    q = (
        db.query(EmailDeliveryEvent)
        .outerjoin(Record, Record.id == EmailDeliveryEvent.record_id)
        .outerjoin(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
    )
    if not is_admin(session):
        q = apply_record_scope_filter(q, db, session, Record)

    if filters.date_from:
        q = q.filter(EmailDeliveryEvent.event_at >= datetime.combine(filters.date_from, time.min))
    if filters.date_to:
        q = q.filter(EmailDeliveryEvent.event_at <= datetime.combine(filters.date_to, time.max))
    if filters.client:
        q = q.filter(Client.name == filters.client)
    if filters.project:
        q = q.filter(Project.name == filters.project)
    if filters.status:
        q = q.filter(EmailDeliveryEvent.status == filters.status)
    if filters.email_kinds:
        q = q.filter(EmailDeliveryEvent.email_kind.in_(filters.email_kinds))

    events = q.order_by(EmailDeliveryEvent.event_at.desc()).limit(filters.limit).all()
    record_ids = [str(event.record_id) for event in events if event.record_id]
    record_context = {}
    if record_ids:
        context_rows = (
            db.query(Record, Client, Project)
            .outerjoin(Client, Client.id == Record.client_id)
            .outerjoin(Project, Project.id == Record.project_id)
            .filter(Record.id.in_(record_ids))
            .all()
        )
        record_context = {str(record.id): (record, client, project) for record, client, project in context_rows}

    items = []
    for event in events:
        record, client, project = record_context.get(str(event.record_id), (None, None, None))

        items.append(
            {
                "id": str(event.id),
                "job_id": str(event.job_id),
                "status": event.status,
                "email_kind": event.email_kind,
                "notification_type": event.notification_type,
                "template_id": event.template_id,
                "subject": event.subject,
                "recipient_count": int(event.recipient_count or 0),
                "attachment_count": int(event.attachment_count or 0),
                "inline_asset_count": int(event.inline_asset_count or 0),
                "to": _json_list(event.to_json),
                "cc": _json_list(event.cc_json),
                "bcc": _json_list(event.bcc_json),
                "scope_type": event.scope_type,
                "scope_id": event.scope_id,
                "record_id": str(event.record_id) if event.record_id else None,
                "minute_title": getattr(record, "title", None) or "Sin minuta asociada",
                "client": getattr(client, "name", None) or "Sin cliente",
                "project": getattr(project, "name", None) or "Sin proyecto",
                "actor_user_id": str(event.actor_user_id) if event.actor_user_id else None,
                "tags": _json_list(event.tags_json),
                "attempt": int(event.attempt or 1),
                "error_message": _clean(event.error_message, "") or None,
                "queued_at": event.queued_at,
                "sent_at": event.sent_at,
                "failed_at": event.failed_at,
                "date": event.event_at,
            }
        )

    return {"items": items, "total": len(items)}

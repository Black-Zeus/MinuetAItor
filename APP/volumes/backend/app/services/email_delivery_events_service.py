from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from core.datetime_utils import utc_now_db
from db.session import SessionLocal
from models.email_delivery_events import EmailDeliveryEvent


def record_email_queued_from_job(job: dict[str, Any]) -> None:
    db = SessionLocal()
    try:
        upsert_email_delivery_event(db, job, status="queued", occurred_at=utc_now_db())
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def upsert_email_delivery_event(
    db: Session,
    job: dict[str, Any],
    *,
    status: str,
    occurred_at: datetime,
    error_message: str | None = None,
) -> EmailDeliveryEvent:
    job_id = str(job.get("job_id") or "").strip() or str(uuid.uuid4())
    payload = job.get("payload") if isinstance(job.get("payload"), dict) else job
    notification_context = payload.get("notification_context") if isinstance(payload, dict) else None
    notification_context = notification_context if isinstance(notification_context, dict) else {}
    metadata = notification_context.get("metadata") if isinstance(notification_context.get("metadata"), dict) else {}
    tags = _clean_list(notification_context.get("tags"))

    obj = db.query(EmailDeliveryEvent).filter(EmailDeliveryEvent.job_id == job_id).first()
    if obj is None:
        obj = EmailDeliveryEvent(id=str(uuid.uuid4()), job_id=job_id)
        db.add(obj)

    to = _clean_list(payload.get("to"))
    cc = _clean_list(payload.get("cc"))
    bcc = _clean_list(payload.get("bcc"))
    record_id = _clean(metadata.get("recordId")) or (
        _clean(notification_context.get("scopeId"))
        if _clean(notification_context.get("scopeType")) == "record"
        else None
    )

    obj.queue_name = _clean(job.get("queue"), "queue:email")
    obj.status = status
    obj.email_kind = _email_kind(tags, payload, notification_context)
    obj.notification_type = _clean(notification_context.get("notificationType") or notification_context.get("notification_type"))
    obj.template_id = _clean(payload.get("template_id"))
    obj.subject = _clean(payload.get("subject"), "Correo sin asunto")
    obj.email_type = _clean(payload.get("email_type"), "html")
    obj.to_json = _json(to)
    obj.cc_json = _json(cc)
    obj.bcc_json = _json(bcc)
    obj.recipient_count = len(to) + len(cc) + len(bcc)
    obj.attachment_count = len(payload.get("attachments") or [])
    obj.inline_asset_count = len(payload.get("inline_assets") or [])
    obj.scope_type = _clean(notification_context.get("scopeType") or notification_context.get("scope_type"))
    obj.scope_id = _clean(notification_context.get("scopeId") or notification_context.get("scope_id"))
    obj.record_id = record_id
    obj.actor_user_id = _clean(notification_context.get("actorUserId") or notification_context.get("actor_user_id"))
    obj.tags_json = _json(tags)
    obj.metadata_json = _json(metadata)
    obj.attempt = int(job.get("attempt") or 1)
    obj.error_message = _clean(error_message)

    if status == "queued":
        obj.queued_at = obj.queued_at or occurred_at
    elif status == "sent":
        obj.sent_at = occurred_at
    elif status == "failed":
        obj.failed_at = occurred_at
    obj.event_at = occurred_at

    return obj


def _clean(value: Any, fallback: str | None = None) -> str | None:
    if value is None:
        return fallback
    raw = str(value).strip()
    return raw or fallback


def _clean_list(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        value = [value]
    return [str(item).strip() for item in value if str(item or "").strip()]


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _email_kind(tags: list[str], payload: dict[str, Any], notification_context: dict[str, Any]) -> str:
    tag_set = {tag.casefold() for tag in tags}
    if {"minute.review.email.sent", "minute.review.email.failed"} & tag_set:
        return "minute_review"
    if {"minute.publication.email.sent", "minute.publication.email.failed"} & tag_set:
        return "minute_publication"
    if {"minute.officialized.email.sent", "minute.officialized.email.failed"} & tag_set:
        return "minute_officialized"
    if {"minute.analysis.email.sent", "minute.analysis.email.failed"} & tag_set:
        return "minute_analysis"
    if "queue.email" in tag_set:
        return "system_queue"
    if _clean(notification_context.get("scopeType") or notification_context.get("scope_type")) == "record":
        return "minute"
    if _clean(payload.get("template_id")):
        return "templated"
    return "system"

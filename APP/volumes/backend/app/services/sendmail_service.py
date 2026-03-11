# services/sendmail_service.py
"""
Servicios para el endpoint de debug de email.
Operaciones sobre la cola Redis de emails.
"""
from __future__ import annotations

import json
import logging
import uuid

from redis.asyncio import Redis

from core.exceptions import BadRequestException
from schemas.sendmail import (
    MailTemplateListResponse,
    MailTemplatePreviewRequest,
    MailTemplatePreviewResponse,
    QueueClearResponse,
    QueueJobItem,
    QueueStatusResponse,
    SendMailRequest,
    SendMailResponse,
)
from services.email_template_service import (
    get_inline_assets_for_html,
    list_email_templates,
    render_email_template,
)

logger = logging.getLogger(__name__)

QUEUE_EMAIL = "queue:email"
# Máximo de jobs a inspeccionar en /queue (no destruye la cola, usa LRANGE)
MAX_INSPECT = 50


async def enqueue_email(payload: SendMailRequest, redis: Redis) -> SendMailResponse:
    """Encola un email y retorna confirmación con largo de cola actual."""
    subject = payload.subject
    body = payload.body
    inline_assets = [asset.model_dump(by_alias=False) for asset in (payload.inline_assets or [])]

    if payload.template_id:
        try:
            rendered = render_email_template(
                payload.template_id,
                payload.template_context or {},
                subject_override=payload.subject,
            )
        except ValueError as exc:
            raise BadRequestException(str(exc)) from exc
        subject = rendered.subject
        body = rendered.html
        inline_assets = _merge_inline_assets(
            inline_assets,
            [asset.model_dump(by_alias=False) for asset in get_inline_assets_for_html(body)],
        )

    job = {
        "job_id": str(uuid.uuid4()),
        "type": "email",
        "queue": QUEUE_EMAIL,
        "attempt": 1,
        "payload": {
            "to": payload.to,
            "cc": payload.cc,
            "bcc": payload.bcc,
            "subject": subject,
            "body": body,
            "email_type": payload.email_type,
            "reply_to": payload.reply_to,
            "template_id": payload.template_id,
            "inline_assets": inline_assets,
        },
    }

    await redis.rpush(QUEUE_EMAIL, json.dumps(job))
    queue_length = await redis.llen(QUEUE_EMAIL)

    logger.info(
        "Email encolado via /sendmail | subject=%s | to=%s | template_id=%s",
        subject,
        payload.to,
        payload.template_id,
    )

    return SendMailResponse(
        queued=True,
        message=f"Email encolado correctamente en '{QUEUE_EMAIL}'",
        queue_length=queue_length,
    )


async def get_queue_status(redis: Redis) -> QueueStatusResponse:
    """
    Inspecciona la cola sin consumirla (LRANGE).
    Retorna los primeros MAX_INSPECT jobs con metadata básica.
    """
    raw_jobs: list[str] = await redis.lrange(QUEUE_EMAIL, 0, MAX_INSPECT - 1)
    total_length: int   = await redis.llen(QUEUE_EMAIL)

    jobs: list[QueueJobItem] = []
    for i, raw in enumerate(raw_jobs):
        try:
            job = json.loads(raw)
            payload = job.get("payload", job)
            jobs.append(QueueJobItem(
                position   = i + 1,
                type       = job.get("type", "unknown"),
                to         = payload.get("to", []),
                subject    = payload.get("subject", "(sin asunto)"),
                email_type = payload.get("email_type", "html"),
                template_id= payload.get("template_id"),
                inline_assets=len(payload.get("inline_assets") or []),
            ))
        except json.JSONDecodeError:
            jobs.append(QueueJobItem(
                position   = i + 1,
                type       = "invalid_json",
                to         = [],
                subject    = "(job corrupto)",
                email_type = "unknown",
                template_id= None,
                inline_assets=0,
            ))

    return QueueStatusResponse(
        queue  = QUEUE_EMAIL,
        length = total_length,
        jobs   = jobs,
    )


async def clear_queue(redis: Redis) -> QueueClearResponse:
    """Vacía completamente la cola de emails."""
    length_before: int = await redis.llen(QUEUE_EMAIL)
    await redis.delete(QUEUE_EMAIL)

    logger.warning("Cola de email vaciada manualmente | jobs_eliminados=%d", length_before)

    return QueueClearResponse(
        queue   = QUEUE_EMAIL,
        cleared = length_before,
        message = f"{length_before} job(s) eliminados de '{QUEUE_EMAIL}'",
    )


def get_available_templates() -> MailTemplateListResponse:
    return MailTemplateListResponse(templates=list_email_templates())


def preview_template(payload: MailTemplatePreviewRequest) -> MailTemplatePreviewResponse:
    try:
        rendered = render_email_template(
            payload.template_id,
            payload.template_context,
            subject_override=payload.subject,
        )
    except ValueError as exc:
        raise BadRequestException(str(exc)) from exc
    return MailTemplatePreviewResponse(
        template_id=rendered.template_id,
        subject=rendered.subject,
        html=rendered.html,
        placeholders=rendered.placeholders,
    )


def _merge_inline_assets(*asset_groups: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for group in asset_groups:
        for asset in group:
            cid = str(asset.get("cid") or "").strip()
            if cid:
                merged[cid] = asset
    return list(merged.values())

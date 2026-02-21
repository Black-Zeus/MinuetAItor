# services/sendmail_service.py
"""
Servicios para el endpoint de debug de email.
Operaciones sobre la cola Redis de emails.
"""
from __future__ import annotations

import json
import logging

from redis.asyncio import Redis

from schemas.sendmail import (
    QueueClearResponse,
    QueueJobItem,
    QueueStatusResponse,
    SendMailRequest,
    SendMailResponse,
)

logger = logging.getLogger(__name__)

QUEUE_EMAIL = "queue:email"
# Máximo de jobs a inspeccionar en /queue (no destruye la cola, usa LRANGE)
MAX_INSPECT = 50


async def enqueue_email(payload: SendMailRequest, redis: Redis) -> SendMailResponse:
    """Encola un email y retorna confirmación con largo de cola actual."""
    job = {
        "type":       "email",
        "to":         payload.to,
        "cc":         payload.cc,
        "bcc":        payload.bcc,
        "subject":    payload.subject,
        "body":       payload.body,
        "email_type": payload.email_type,
        "reply_to":   payload.reply_to,
    }

    await redis.rpush(QUEUE_EMAIL, json.dumps(job))
    queue_length = await redis.llen(QUEUE_EMAIL)

    logger.info("Email encolado vía /sendmail | subject=%s | to=%s", payload.subject, payload.to)

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
            jobs.append(QueueJobItem(
                position   = i + 1,
                type       = job.get("type", "unknown"),
                to         = job.get("to", []),
                subject    = job.get("subject", "(sin asunto)"),
                email_type = job.get("email_type", "html"),
            ))
        except json.JSONDecodeError:
            jobs.append(QueueJobItem(
                position   = i + 1,
                type       = "invalid_json",
                to         = [],
                subject    = "(job corrupto)",
                email_type = "unknown",
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
# core/dlq.py
"""
Dead Letter Queue (DLQ).

Cuando un job agota todos sus reintentos, se envía aquí.
La DLQ es simplemente otra lista Redis con metadata de error.

Cola: queue:dlq

Formato del mensaje en DLQ:
{
    "job_id":       "...",
    "type":         "email",
    "queue":        "queue:email",
    "attempt":      3,
    "payload":      { ... },
    "failed_at":    "2025-01-01T12:00:00Z",
    "error":        "Traceback ..."
}

Para reinspeccionar / reencolar desde DLQ, usar RedisInsight o un
futuro endpoint admin del backend.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import redis.asyncio as aioredis

from core.job import JobEnvelope
from core.logging_config import get_logger

logger = get_logger("worker.dlq")

DLQ_KEY = "queue:dlq"
# Máximo de mensajes que guardamos en DLQ (FIFO, los más viejos se eliminan)
DLQ_MAX_SIZE = int(1000)


async def send_to_dlq(
    redis:  aioredis.Redis,
    job:    JobEnvelope,
    error:  str,
) -> None:
    """
    Manda un job a la Dead Letter Queue con contexto del error.
    Usa RPUSH + LTRIM para mantener tamaño máximo.
    """
    record = {
        "job_id":    job.job_id,
        "type":      job.type,
        "queue":     job.queue,
        "attempt":   job.attempt,
        "payload":   job.payload,
        "failed_at": datetime.now(timezone.utc).isoformat(),
        "error":     error[:2000],  # truncar tracebacks muy largos
    }

    await redis.rpush(DLQ_KEY, json.dumps(record))
    await redis.ltrim(DLQ_KEY, -DLQ_MAX_SIZE, -1)  # conserva solo los últimos N

    logger.error(
        "Job enviado a DLQ | job_id=%s type=%s queue=%s attempt=%d",
        job.job_id, job.type, job.queue, job.attempt,
    )


async def get_dlq_size(redis: aioredis.Redis) -> int:
    return await redis.llen(DLQ_KEY)
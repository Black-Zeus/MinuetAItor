# services/email_queue.py
"""
Helper para encolar emails desde el backend FastAPI.
No envía directamente — delega al worker vía Redis.
"""

import json
import logging
from typing import Optional

from db.redis import get_redis

logger = logging.getLogger(__name__)

QUEUE_EMAIL = "queue:email"


async def queue_email(
    to: list[str],
    subject: str,
    body: str,
    *,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    email_type: str = "html",
    reply_to: Optional[str] = None,
) -> None:
    """
    Encola un email para ser procesado por el worker.
    
    Uso desde cualquier servicio:
        await queue_email(
            to=["user@example.com"],
            subject="Bienvenido",
            body="<h1>Hola!</h1>",
        )
    """
    job = {
        "type":       "email",
        "to":         to,
        "subject":    subject,
        "body":       body,
        "cc":         cc,
        "bcc":        bcc,
        "email_type": email_type,
        "reply_to":   reply_to,
    }

    redis = get_redis()
    await redis.rpush(QUEUE_EMAIL, json.dumps(job))
    logger.info("Email encolado | subject=%s | to=%s", subject, to)
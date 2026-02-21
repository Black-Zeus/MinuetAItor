# handlers/email_handler.py
"""
Handler de jobs de email para el worker.

Formato del job (JSON en Redis):
{
    "type": "email",
    "to":      ["user@example.com"],
    "cc":      ["cc@example.com"],        # opcional
    "bcc":     ["bcc@example.com"],       # opcional
    "subject": "Asunto del correo",
    "body":    "<h1>Hola</h1>",
    "email_type": "html",                 # "html" | "text"
    "reply_to": "no-reply@example.com"   # opcional
}
"""

import logging
from typing import Any

from services.email_service import get_email_service

logger = logging.getLogger(__name__)


def handle_email_job(job: dict[str, Any]) -> None:
    """
    Procesa un job de tipo 'email' desde la cola Redis.
    
    Args:
        job: Diccionario con los datos del correo.
    
    Raises:
        KeyError: Si faltan campos obligatorios.
    """
    svc = get_email_service()

    svc.send(
        to         = job["to"],
        subject    = job["subject"],
        body       = job["body"],
        cc         = job.get("cc"),
        bcc        = job.get("bcc"),
        type       = job.get("email_type", "html"),
        reply_to   = job.get("reply_to"),
    )
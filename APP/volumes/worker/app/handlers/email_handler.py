# handlers/email_handler.py
"""
Handler de jobs de tipo 'email'.

Envía correos electrónicos usando SMTP.

Payload esperado:
{
    "to": "destinatario@ejemplo.com",
    "subject": "Asunto del correo",
    "body": "Contenido del correo",
    "html": "<p>Contenido HTML</p>",  # opcional
    "attachments": [...]  # opcional
}
"""
from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage
from typing import Any

from core.config import settings
from core.logging_config import get_logger
from core.job import JobEnvelope

logger = get_logger("worker.handler.email")


async def handle_email_job(job: JobEnvelope) -> None:
    """
    Envía un correo electrónico.
    """
    payload = job.payload
    to = payload.get("to")
    subject = payload.get("subject", "Notificación MinuetAItor")
    body = payload.get("body", "")
    html = payload.get("html")
    
    if not to:
        raise ValueError("El campo 'to' es requerido para enviar email")
    
    logger.info(
        "Enviando email | to=%s subject=%s job_id=%s attempt=%d",
        to, subject, job.job_id, job.attempt,
    )
    
    # Ejecutar la operación SMTP en un executor para no bloquear el event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_email_sync, to, subject, body, html)
    
    logger.info("Email enviado | to=%s", to)


def _send_email_sync(to: str, subject: str, body: str, html: str | None = None) -> None:
    """
    Función síncrona para enviar email usando SMTP.
    """
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to
    
    if html:
        msg.set_content(body)
        msg.add_alternative(html, subtype="html")
    else:
        msg.set_content(body)
    
    with smtplib.SMTP(
        host=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        timeout=settings.SMTP_TIMEOUT
    ) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        
        server.send_message(msg)
        logger.debug("Email enviado síncronamente | to=%s", to)
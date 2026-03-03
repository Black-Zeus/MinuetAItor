# handlers/email_handler.py
"""
Handler de jobs de tipo 'email'.

Payload esperado (dentro de JobEnvelope.payload):
{
    "to":         ["user@example.com"],
    "subject":    "Asunto",
    "body":       "<h1>Hola</h1>",
    "cc":         ["cc@example.com"],       # opcional
    "bcc":        ["bcc@example.com"],      # opcional
    "email_type": "html",                   # "html" | "text"
    "reply_to":   "no-reply@example.com"   # opcional
}

El handler es async pero el envío SMTP es síncrono (smtplib).
Se ejecuta en un executor para no bloquear el event loop.
"""
from __future__ import annotations

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from core.config import settings
from core.logging_config import get_logger

logger = get_logger("worker.handler.email")


def _send_sync(payload: dict[str, Any]) -> None:
    """
    Envío SMTP síncrono.
    Se llama desde run_in_executor para no bloquear asyncio.
    """
    to:         list[str] = payload["to"]
    subject:    str       = payload["subject"]
    body:       str       = payload["body"]
    cc:         list[str] = payload.get("cc")  or []
    bcc:        list[str] = payload.get("bcc") or []
    email_type: str       = payload.get("email_type", "html")
    reply_to:   str | None = payload.get("reply_to")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"]      = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    if reply_to:
        msg["Reply-To"] = reply_to

    subtype = "html" if email_type == "html" else "plain"
    msg.attach(MIMEText(body, subtype, "utf-8"))

    all_recipients = to + cc + bcc

    smtp_cls = smtplib.SMTP_SSL if settings.SMTP_USE_SSL else smtplib.SMTP

    with smtp_cls(settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT) as server:
        if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
            server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM_EMAIL, all_recipients, msg.as_string())

    logger.info(
        "Email enviado | to=%s subject=%r",
        to, subject[:60],
    )


async def handle_email_job(payload: dict[str, Any]) -> None:
    """
    Handler principal — async wrapper sobre el envío SMTP síncrono.
    El executor evita bloquear el event loop durante la conexión SMTP.
    """
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_sync, payload)
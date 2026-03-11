from __future__ import annotations

import asyncio
import html
import mimetypes
import re
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from core.config import settings
from core.job import JobEnvelope
from core.logging_config import get_logger

logger = get_logger("worker.handler.email")

TAG_RE = re.compile(r"<[^>]+>")
LINE_BREAK_TAGS = ("<br>", "<br/>", "<br />", "</p>", "</div>", "</li>", "</tr>")


async def handle_email_job(job: JobEnvelope) -> None:
    payload = job.payload
    to = _normalize_recipients(payload.get("to"))
    cc = _normalize_recipients(payload.get("cc"))
    bcc = _normalize_recipients(payload.get("bcc"))
    if not to:
        raise ValueError("El campo 'to' es requerido para enviar email")

    subject = str(payload.get("subject") or "Notificacion MinuetAItor")
    email_type = str(payload.get("email_type") or "html").lower()
    reply_to = payload.get("reply_to")
    body = str(payload.get("body") or "")
    inline_assets = payload.get("inline_assets") or []

    logger.info(
        "Enviando email | to=%s cc=%s bcc=%s subject=%s job_id=%s attempt=%d template_id=%s",
        to,
        cc,
        bcc,
        subject,
        job.job_id,
        job.attempt,
        payload.get("template_id"),
    )

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        _send_email_sync,
        to,
        cc,
        bcc,
        subject,
        body,
        email_type,
        reply_to,
        inline_assets,
    )

    logger.info("Email enviado | to=%s subject=%s", to, subject)


def _send_email_sync(
    to: list[str],
    cc: list[str],
    bcc: list[str],
    subject: str,
    body: str,
    email_type: str,
    reply_to: str | None,
    inline_assets: list[dict[str, Any]],
) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    if reply_to:
        msg["Reply-To"] = str(reply_to)

    if email_type == "html":
        text_body = _html_to_text(body)
        msg.set_content(text_body or "Este correo requiere un cliente compatible con HTML.")
        msg.add_alternative(body, subtype="html")
        if inline_assets:
            _attach_inline_assets(msg, inline_assets)
        else:
            _attach_inline_logo_if_needed(msg, body)
    else:
        msg.set_content(body)

    recipients = to + cc + bcc
    with _open_smtp_client() as server:
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg, to_addrs=recipients)
        logger.debug("Email enviado sincronamente | recipients=%s", recipients)


def _open_smtp_client() -> smtplib.SMTP:
    if settings.SMTP_USE_SSL:
        return smtplib.SMTP_SSL(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            timeout=settings.SMTP_TIMEOUT,
        )

    client = smtplib.SMTP(
        host=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        timeout=settings.SMTP_TIMEOUT,
    )
    if settings.SMTP_USE_TLS:
        client.starttls()
    return client


def _normalize_recipients(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        cleaned = value.strip()
        return [cleaned] if cleaned else []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    raise ValueError("Formato invalido para destinatarios de email")


def _html_to_text(raw_html: str) -> str:
    text = raw_html
    for tag in LINE_BREAK_TAGS:
        text = text.replace(tag, f"{tag}\n")
    text = TAG_RE.sub("", text)
    text = html.unescape(text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip()


def _attach_inline_logo_if_needed(msg: EmailMessage, html_body: str) -> None:
    if "cid:minuetaitor-logo" not in html_body:
        return
    _attach_inline_assets(
        msg,
        [{
            "cid": "minuetaitor-logo",
            "path": settings.EMAIL_INLINE_LOGO_PATH,
            "mime_type": "image/jpeg",
        }],
    )


def _attach_inline_assets(msg: EmailMessage, inline_assets: list[dict[str, Any]]) -> None:
    html_part = msg.get_payload()[-1]
    for asset in inline_assets:
        cid = str(asset.get("cid") or "").strip()
        path_value = str(asset.get("path") or "").strip()
        mime_type = str(asset.get("mime_type") or "").strip()

        if not cid or not path_value:
            logger.warning("Inline asset ignorado por datos incompletos | asset=%s", asset)
            continue

        asset_path = Path(path_value)
        if not asset_path.exists():
            logger.warning("Inline asset no encontrado | cid=%s path=%s", cid, asset_path)
            continue

        if not mime_type:
            guessed_mime, _ = mimetypes.guess_type(asset_path.name)
            mime_type = guessed_mime or "application/octet-stream"

        maintype, subtype = mime_type.split("/", 1)
        with asset_path.open("rb") as fh:
            html_part.add_related(
                fh.read(),
                maintype=maintype,
                subtype=subtype,
                cid=f"<{cid}>",
                filename=asset_path.name,
            )

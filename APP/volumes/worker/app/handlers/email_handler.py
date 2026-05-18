from __future__ import annotations

import asyncio
import base64
import html
import mimetypes
import re
import smtplib
import threading
import time
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import sessionmaker

from core.backend_client import ingest_notification
from core.config import settings
from core.job import JobEnvelope
from core.logging_config import get_logger

logger = get_logger("worker.handler.email")

TAG_RE = re.compile(r"<[^>]+>")
LINE_BREAK_TAGS = ("<br>", "<br/>", "<br />", "</p>", "</div>", "</li>", "</tr>")
SMTP_CACHE_TTL_SECONDS = 30

_SMTP_CACHE_LOCK = threading.Lock()
_SMTP_CACHE_EXPIRES_AT = 0.0
_SMTP_CACHE_DATA: dict[str, Any] | None = None
_SessionLocal: sessionmaker | None = None


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
    attachments = payload.get("attachments") or []

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
        attachments,
    )

    notification_context = payload.get("notification_context")
    if isinstance(notification_context, dict) and notification_context:
        try:
            await loop.run_in_executor(None, ingest_notification, notification_context)
        except Exception as exc:
            logger.warning(
                "No se pudo registrar notificación post-email | job_id=%s subject=%s err=%s",
                job.job_id,
                subject,
                exc,
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
    attachments: list[dict[str, Any]],
) -> None:
    smtp_config = _get_runtime_smtp_config()

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f'{smtp_config["from_name"]} <{smtp_config["from_email"]}>'
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

    if attachments:
        _attach_attachments(msg, attachments)

    recipients = to + cc + bcc
    server = _open_smtp_client(smtp_config)
    try:
        # Mailpit en dev no requiere autenticacion aunque dejemos un password
        # explicito para validadores de entorno.
        if (
            smtp_config.get("username")
            and smtp_config.get("password")
            and str(smtp_config["host"]).lower() != "mailpit"
        ):
            server.login(smtp_config["username"], smtp_config["password"])
        server.send_message(msg, to_addrs=recipients)
        logger.debug("Email enviado sincronamente | recipients=%s", recipients)
    finally:
        try:
            server.quit()
        except (smtplib.SMTPServerDisconnected, OSError):
            try:
                server.close()
            except Exception:
                pass


def _get_db_session() -> sessionmaker:
    global _SessionLocal
    if _SessionLocal is None:
        engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
        _SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return _SessionLocal


def _is_missing_smtp_table_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return (
        "smtp_configs" in text
        and ("doesn't exist" in text or "does not exist" in text or "no such table" in text)
    )


def _load_active_smtp_config_from_db() -> dict[str, Any] | None:
    SessionLocal = _get_db_session()
    query = text(
        """
        SELECT
          host,
          port,
          username,
          password,
          from_name,
          from_email,
          use_tls,
          use_ssl,
          timeout_seconds
        FROM smtp_configs
        WHERE deleted_at IS NULL
          AND is_active = 1
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
        """
    )

    try:
        with SessionLocal() as db:
            row = db.execute(query).mappings().first()
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_smtp_table_error(exc):
            raise RuntimeError(
                "La tabla smtp_configs aún no está disponible. Aplica el esquema antes de enviar correos."
            ) from exc
        raise

    if not row:
        return None

    return {
        "host": row["host"],
        "port": int(row["port"]),
        "username": row["username"] or None,
        "password": row["password"] or None,
        "from_name": row["from_name"],
        "from_email": row["from_email"],
        "use_tls": bool(row["use_tls"]),
        "use_ssl": bool(row["use_ssl"]),
        "timeout_seconds": int(row["timeout_seconds"]),
        "source": "db",
    }


def _get_runtime_smtp_config() -> dict[str, Any]:
    global _SMTP_CACHE_DATA, _SMTP_CACHE_EXPIRES_AT

    now = time.monotonic()
    with _SMTP_CACHE_LOCK:
        if _SMTP_CACHE_DATA is not None and now < _SMTP_CACHE_EXPIRES_AT:
            return dict(_SMTP_CACHE_DATA)

    config = _load_active_smtp_config_from_db()
    if not config:
        raise RuntimeError(
            "No hay una configuración SMTP activa. Configúrala en Sistema >> Integraciones >> SMTP antes de enviar correos."
        )

    with _SMTP_CACHE_LOCK:
        _SMTP_CACHE_DATA = dict(config)
        _SMTP_CACHE_EXPIRES_AT = time.monotonic() + SMTP_CACHE_TTL_SECONDS

    logger.debug(
        "Configuracion SMTP resuelta | source=%s host=%s port=%s",
        config.get("source"),
        config.get("host"),
        config.get("port"),
    )
    return dict(config)


def _open_smtp_client(smtp_config: dict[str, Any]) -> smtplib.SMTP:
    if smtp_config.get("use_ssl"):
        return smtplib.SMTP_SSL(
            host=smtp_config["host"],
            port=smtp_config["port"],
            timeout=smtp_config["timeout_seconds"],
        )

    client = smtplib.SMTP(
        host=smtp_config["host"],
        port=smtp_config["port"],
        timeout=smtp_config["timeout_seconds"],
    )
    if smtp_config.get("use_tls"):
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


def _attach_attachments(msg: EmailMessage, attachments: list[dict[str, Any]]) -> None:
    for attachment in attachments:
        filename = str(attachment.get("filename") or "").strip()
        content_base64 = str(attachment.get("content_base64") or "").strip()
        mime_type = str(attachment.get("mime_type") or "").strip() or "application/octet-stream"

        if not filename or not content_base64:
            logger.warning("Adjunto ignorado por datos incompletos | attachment=%s", attachment)
            continue

        try:
            content = base64.b64decode(content_base64)
        except Exception:
            logger.warning("Adjunto ignorado por base64 inválido | filename=%s", filename)
            continue

        maintype, subtype = mime_type.split("/", 1) if "/" in mime_type else ("application", "octet-stream")
        msg.add_attachment(
            content,
            maintype=maintype,
            subtype=subtype,
            filename=filename,
        )

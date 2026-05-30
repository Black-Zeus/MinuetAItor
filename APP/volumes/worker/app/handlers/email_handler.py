from __future__ import annotations

import asyncio
import base64
import html
import json
import mimetypes
import re
import smtplib
import threading
import time
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, event, text
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
INLINE_ASSET_MAX_BYTES = 2 * 1024 * 1024
EMAIL_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024
INLINE_ASSET_ALLOWED_ROOTS = (
    Path("/app/assets/images"),
    Path("/app/email_assets"),
)

_SMTP_CACHE_LOCK = threading.Lock()
_SMTP_CACHE_EXPIRES_AT = 0.0
_SMTP_CACHE_DATA: dict[str, Any] | None = None
_SessionLocal: sessionmaker | None = None


async def handle_email_job(job: JobEnvelope) -> None:
    payload = job.payload
    to = _normalize_recipients(payload.get("to"))
    cc = _normalize_recipients(payload.get("cc"))
    bcc = _normalize_recipients(payload.get("bcc"))
    subject = str(payload.get("subject") or "Notificacion MinuetAItor")
    email_type = str(payload.get("email_type") or "html").lower()
    reply_to = payload.get("reply_to")
    body = str(payload.get("body") or "")
    inline_assets = payload.get("inline_assets") or []
    attachments = payload.get("attachments") or []
    notification_context = payload.get("notification_context")

    loop = asyncio.get_running_loop()
    try:
        if not to:
            raise ValueError("El campo 'to' es requerido para enviar email")

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
    except Exception as exc:
        _safe_record_email_delivery_status(
            job=job,
            payload=payload,
            status="failed",
            subject=subject,
            to=to,
            cc=cc,
            bcc=bcc,
            error_message=str(exc),
        )
        await _notify_email_failure(
            loop=loop,
            job=job,
            payload=payload,
            subject=subject,
            to=to,
            cc=cc,
            bcc=bcc,
            error=exc,
        )
        raise

    _safe_record_email_delivery_status(
        job=job,
        payload=payload,
        status="sent",
        subject=subject,
        to=to,
        cc=cc,
        bcc=bcc,
    )

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


def _safe_record_email_delivery_status(
    *,
    job: JobEnvelope,
    payload: dict[str, Any],
    status: str,
    subject: str,
    to: list[str],
    cc: list[str],
    bcc: list[str],
    error_message: str | None = None,
) -> None:
    try:
        _record_email_delivery_status(
            job=job,
            payload=payload,
            status=status,
            subject=subject,
            to=to,
            cc=cc,
            bcc=bcc,
            error_message=error_message,
        )
    except Exception as exc:
        logger.warning(
            "No se pudo persistir evento de email | job_id=%s status=%s err=%s",
            job.job_id,
            status,
            exc,
        )


def _record_email_delivery_status(
    *,
    job: JobEnvelope,
    payload: dict[str, Any],
    status: str,
    subject: str,
    to: list[str],
    cc: list[str],
    bcc: list[str],
    error_message: str | None = None,
) -> None:
    notification_context = payload.get("notification_context")
    notification_context = notification_context if isinstance(notification_context, dict) else {}
    metadata = notification_context.get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    tags = _clean_delivery_list(notification_context.get("tags"))
    scope_type = _clean_delivery_text(notification_context.get("scopeType") or notification_context.get("scope_type"))
    scope_id = _clean_delivery_text(notification_context.get("scopeId") or notification_context.get("scope_id"))
    record_id = _clean_delivery_text(metadata.get("recordId")) or (scope_id if scope_type == "record" else None)
    occurred_at = datetime.now(timezone.utc).replace(tzinfo=None)
    sent_at = occurred_at if status == "sent" else None
    failed_at = occurred_at if status == "failed" else None

    SessionLocal = _get_db_session()
    query = text(
        """
        INSERT INTO email_delivery_events (
          id, job_id, queue_name, status, email_kind, notification_type,
          template_id, subject, email_type, to_json, cc_json, bcc_json,
          recipient_count, attachment_count, inline_asset_count,
          scope_type, scope_id, record_id, actor_user_id, tags_json, metadata_json,
          attempt, error_message, queued_at, sent_at, failed_at, event_at, created_at, updated_at
        ) VALUES (
          :id, :job_id, :queue_name, :status, :email_kind, :notification_type,
          :template_id, :subject, :email_type, :to_json, :cc_json, :bcc_json,
          :recipient_count, :attachment_count, :inline_asset_count,
          :scope_type, :scope_id, :record_id, :actor_user_id, :tags_json, :metadata_json,
          :attempt, :error_message, :queued_at, :sent_at, :failed_at, :event_at, :created_at, :updated_at
        )
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          email_kind = VALUES(email_kind),
          notification_type = VALUES(notification_type),
          template_id = VALUES(template_id),
          subject = VALUES(subject),
          email_type = VALUES(email_type),
          to_json = VALUES(to_json),
          cc_json = VALUES(cc_json),
          bcc_json = VALUES(bcc_json),
          recipient_count = VALUES(recipient_count),
          attachment_count = VALUES(attachment_count),
          inline_asset_count = VALUES(inline_asset_count),
          scope_type = VALUES(scope_type),
          scope_id = VALUES(scope_id),
          record_id = VALUES(record_id),
          actor_user_id = VALUES(actor_user_id),
          tags_json = VALUES(tags_json),
          metadata_json = VALUES(metadata_json),
          attempt = VALUES(attempt),
          error_message = VALUES(error_message),
          sent_at = COALESCE(VALUES(sent_at), sent_at),
          failed_at = COALESCE(VALUES(failed_at), failed_at),
          event_at = VALUES(event_at),
          updated_at = VALUES(updated_at)
        """
    )
    params = {
        "id": str(uuid.uuid4()),
        "job_id": job.job_id,
        "queue_name": job.queue or "queue:email",
        "status": status,
        "email_kind": _delivery_email_kind(tags, payload, scope_type),
        "notification_type": _clean_delivery_text(
            notification_context.get("notificationType") or notification_context.get("notification_type")
        ),
        "template_id": _clean_delivery_text(payload.get("template_id")),
        "subject": _clean_delivery_text(subject, "Correo sin asunto"),
        "email_type": _clean_delivery_text(payload.get("email_type"), "html"),
        "to_json": _delivery_json(to),
        "cc_json": _delivery_json(cc),
        "bcc_json": _delivery_json(bcc),
        "recipient_count": len(to) + len(cc) + len(bcc),
        "attachment_count": len(payload.get("attachments") or []),
        "inline_asset_count": len(payload.get("inline_assets") or []),
        "scope_type": scope_type,
        "scope_id": scope_id,
        "record_id": record_id,
        "actor_user_id": _clean_delivery_text(
            notification_context.get("actorUserId") or notification_context.get("actor_user_id")
        ),
        "tags_json": _delivery_json(tags),
        "metadata_json": _delivery_json(metadata),
        "attempt": int(job.attempt or 1),
        "error_message": _clean_delivery_text(error_message),
        "queued_at": occurred_at,
        "sent_at": sent_at,
        "failed_at": failed_at,
        "event_at": occurred_at,
        "created_at": occurred_at,
        "updated_at": occurred_at,
    }

    with SessionLocal() as db:
        db.execute(query, params)
        db.commit()


def _clean_delivery_text(value: Any, fallback: str | None = None) -> str | None:
    if value is None:
        return fallback
    raw = str(value).strip()
    return raw or fallback


def _clean_delivery_list(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        value = [value]
    return [str(item).strip() for item in value if str(item or "").strip()]


def _delivery_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _delivery_email_kind(tags: list[str], payload: dict[str, Any], scope_type: str | None) -> str:
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
    if scope_type == "record":
        return "minute"
    if _clean_delivery_text(payload.get("template_id")):
        return "templated"
    return "system"


async def _notify_email_failure(
    *,
    loop: asyncio.AbstractEventLoop,
    job: JobEnvelope,
    payload: dict[str, Any],
    subject: str,
    to: list[str],
    cc: list[str],
    bcc: list[str],
    error: Exception,
) -> None:
    notification = _build_email_failure_notification(
        job=job,
        payload=payload,
        subject=subject,
        to=to,
        cc=cc,
        bcc=bcc,
        error=error,
    )
    if not notification:
        return

    try:
        await loop.run_in_executor(None, ingest_notification, notification)
    except Exception as notify_exc:
        logger.warning(
            "No se pudo registrar notificación de error de email | job_id=%s subject=%s err=%s",
            job.job_id,
            subject,
            notify_exc,
        )


def _build_email_failure_notification(
    *,
    job: JobEnvelope,
    payload: dict[str, Any],
    subject: str,
    to: list[str],
    cc: list[str],
    bcc: list[str],
    error: Exception,
) -> dict[str, Any] | None:
    base = payload.get("notification_context")
    if not isinstance(base, dict) or not base:
        return None

    original_tags = [str(tag or "").strip() for tag in (base.get("tags") or []) if str(tag or "").strip()]
    failed_tags = _failure_tags_from_success_tags(original_tags)
    metadata = dict(base.get("metadata") or {})
    metadata.update(
        {
            "emailSubject": subject,
            "jobId": job.job_id,
            "queue": job.queue,
            "attempt": job.attempt,
            "recipientEmails": to,
            "ccEmails": cc,
            "bccEmails": bcc,
            "error": str(error)[:1000],
            "originalNotificationType": base.get("notificationType") or base.get("notification_type"),
        }
    )

    return {
        **base,
        "notificationType": "email.failed",
        "title": "Error al enviar correo",
        "message": _failure_message_from_payload(base.get("message"), metadata, subject),
        "level": "error",
        "tags": failed_tags,
        "metadata": metadata,
    }


def _failure_tags_from_success_tags(tags: list[str]) -> list[str]:
    clean: list[str] = []
    seen: set[str] = set()

    def append(tag: str) -> None:
        value = str(tag or "").strip()
        if not value:
            return
        key = value.casefold()
        if key in seen:
            return
        seen.add(key)
        clean.append(value)

    for tag in tags:
        if tag == "sent":
            append("failed")
        elif tag.endswith(".sent"):
            append(f"{tag[:-5]}.failed")
        else:
            append(tag)

    append("email")
    append("failed")
    return clean


def _failure_message_from_payload(original_message: Any, metadata: dict[str, Any], subject: str) -> str:
    sent_items = _normalize_delivery_items(metadata.get("sentRecipients"))
    skipped_items = _normalize_delivery_items(metadata.get("skippedRecipients"))
    fallback_used = bool(metadata.get("fallbackUsed"))

    if sent_items or skipped_items:
        parts = [f'No se pudo enviar el correo "{subject}".']
        if sent_items:
            parts.append(f"Se intentó enviar a: {_summarize_delivery_items(sent_items)}.")
        if fallback_used:
            parts.append("Estaba considerado el fallback al elaborador responsable.")
        if skipped_items:
            parts.append(f"No se consideró a: {_summarize_delivery_items(skipped_items)}.")
        return " ".join(parts)[:1900]

    return _failure_message_from_success_message(original_message, subject)


def _failure_message_from_success_message(original_message: Any, subject: str) -> str:
    message = str(original_message or "").strip()
    if message:
        replacements = (
            ("Se envió", "No se pudo enviar"),
            ("se envió", "no se pudo enviar"),
            ("Correo enviado", "Error al enviar correo"),
        )
        updated = message
        for source, target in replacements:
            updated = updated.replace(source, target)
        if updated != message:
            return updated

    return f'No se pudo enviar el correo "{subject}".'


def _normalize_delivery_items(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    items: list[dict[str, str]] = []
    for raw in value:
        if not isinstance(raw, dict):
            continue
        items.append(
            {
                "name": str(raw.get("name") or "").strip(),
                "email": str(raw.get("email") or "").strip(),
                "reason": str(raw.get("reason") or "").strip(),
            }
        )
    return [item for item in items if item["name"] or item["email"] or item["reason"]]


def _summarize_delivery_items(items: list[dict[str, str]], *, max_items: int = 4) -> str:
    if not items:
        return "ninguno"

    labels: list[str] = []
    for item in items[:max_items]:
        name = item.get("name") or ""
        email = item.get("email") or ""
        reason = item.get("reason") or ""
        if name and email and name.casefold() != email.casefold():
            label = f"{name} <{email}>"
        else:
            label = email or name or "Destinatario"
        if reason:
            label = f"{label} ({reason})"
        labels.append(label)

    remaining = len(items) - max_items
    if remaining > 0:
        labels.append(f"+{remaining} más")
    return ", ".join(labels)


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

        @event.listens_for(engine, "connect")
        def set_utc_timezone(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("SET time_zone = '+00:00'")
            finally:
                cursor.close()

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
        content_base64 = str(asset.get("content_base64") or "").strip()
        mime_type = str(asset.get("mime_type") or "").strip()

        if not cid or (not path_value and not content_base64):
            logger.warning("Inline asset ignorado por datos incompletos | asset=%s", asset)
            continue

        if not mime_type:
            if path_value:
                guessed_mime, _ = mimetypes.guess_type(Path(path_value).name)
                mime_type = guessed_mime or "application/octet-stream"
            else:
                mime_type = "application/octet-stream"

        maintype, subtype = mime_type.split("/", 1) if "/" in mime_type else ("application", "octet-stream")

        if content_base64:
            if _estimated_base64_decoded_size(content_base64) > INLINE_ASSET_MAX_BYTES:
                logger.warning("Inline asset ignorado por tamaño base64 | cid=%s", cid)
                continue
            try:
                asset_content = base64.b64decode(content_base64)
            except Exception:
                logger.warning("Inline asset ignorado por base64 inválido | cid=%s", cid)
                continue
            html_part.add_related(
                asset_content,
                maintype=maintype,
                subtype=subtype,
                cid=f"<{cid}>",
            )
            continue

        asset_path = _resolve_allowed_inline_asset_path(path_value)
        if asset_path is None:
            logger.warning("Inline asset ignorado por path no permitido | cid=%s", cid)
            continue
        if not asset_path.exists() or not asset_path.is_file():
            logger.warning("Inline asset no encontrado | cid=%s path=%s", cid, asset_path)
            continue
        if asset_path.stat().st_size > INLINE_ASSET_MAX_BYTES:
            logger.warning("Inline asset ignorado por tamaño | cid=%s path=%s", cid, asset_path)
            continue

        with asset_path.open("rb") as fh:
            html_part.add_related(
                fh.read(),
                maintype=maintype,
                subtype=subtype,
                cid=f"<{cid}>",
                filename=asset_path.name,
            )


def _resolve_allowed_inline_asset_path(path_value: str) -> Path | None:
    try:
        candidate = Path(path_value).resolve(strict=False)
    except Exception:
        return None

    for root in INLINE_ASSET_ALLOWED_ROOTS:
        allowed_root = root.resolve(strict=False)
        if candidate == allowed_root or allowed_root in candidate.parents:
            return candidate
    return None


def _attach_attachments(msg: EmailMessage, attachments: list[dict[str, Any]]) -> None:
    for attachment in attachments:
        filename = str(attachment.get("filename") or "").strip()
        content_base64 = str(attachment.get("content_base64") or "").strip()
        mime_type = str(attachment.get("mime_type") or "").strip() or "application/octet-stream"

        if not filename or not content_base64:
            logger.warning("Adjunto ignorado por datos incompletos | attachment=%s", attachment)
            continue

        try:
            if _estimated_base64_decoded_size(content_base64) > EMAIL_ATTACHMENT_MAX_BYTES:
                logger.warning("Adjunto ignorado por tamaño base64 | filename=%s", filename)
                continue
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


def _estimated_base64_decoded_size(value: str) -> int:
    compact = "".join(str(value or "").split())
    if not compact:
        return 0
    padding = compact.count("=")
    return max((len(compact) * 3 // 4) - padding, 0)

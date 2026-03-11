# services/email_queue.py
"""
Helper para encolar emails desde el backend FastAPI.
No envía directamente — delega al worker vía Redis.
"""

import json
import logging
import uuid
from typing import Any, Optional

from db.redis import get_redis
from schemas.sendmail import EmailAttachment, InlineAsset
from services.email_template_service import get_inline_assets_for_html, render_email_template

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
    inline_assets: Optional[list[InlineAsset | dict[str, Any]]] = None,
    attachments: Optional[list[EmailAttachment | dict[str, Any]]] = None,
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
        "job_id": str(uuid.uuid4()),
        "type": "email",
        "queue": QUEUE_EMAIL,
        "attempt": 1,
        "payload": {
            "to": to,
            "subject": subject,
            "body": body,
            "cc": cc,
            "bcc": bcc,
            "email_type": email_type,
            "reply_to": reply_to,
            "template_id": None,
            "inline_assets": _serialize_inline_assets(inline_assets),
            "attachments": _serialize_attachments(attachments),
        },
    }

    redis = get_redis()
    await redis.rpush(QUEUE_EMAIL, json.dumps(job))
    logger.info("Email encolado | subject=%s | to=%s", subject, to)


async def queue_templated_email(
    to: list[str],
    template_id: str,
    template_context: dict[str, Any],
    *,
    subject: str | None = None,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    reply_to: Optional[str] = None,
    inline_assets: Optional[list[InlineAsset | dict[str, Any]]] = None,
    attachments: Optional[list[EmailAttachment | dict[str, Any]]] = None,
) -> None:
    rendered = render_email_template(
        template_id,
        template_context,
        subject_override=subject,
    )
    job = {
        "job_id": str(uuid.uuid4()),
        "type": "email",
        "queue": QUEUE_EMAIL,
        "attempt": 1,
        "payload": {
            "to": to,
            "subject": rendered.subject,
            "body": rendered.html,
            "cc": cc,
            "bcc": bcc,
            "email_type": "html",
            "reply_to": reply_to,
            "template_id": template_id,
            "inline_assets": _merge_inline_assets(
                _serialize_inline_assets(inline_assets),
                [asset.model_dump(by_alias=False) for asset in get_inline_assets_for_html(rendered.html)],
            ),
            "attachments": _serialize_attachments(attachments),
        },
    }

    redis = get_redis()
    await redis.rpush(QUEUE_EMAIL, json.dumps(job))
    logger.info("Email template encolado | template_id=%s | to=%s", template_id, to)


def _serialize_inline_assets(
    inline_assets: Optional[list[InlineAsset | dict[str, Any]]],
) -> list[dict[str, Any]]:
    if not inline_assets:
        return []
    serialized: list[dict[str, Any]] = []
    for asset in inline_assets:
        if isinstance(asset, InlineAsset):
            serialized.append(asset.model_dump(by_alias=False))
        else:
            serialized.append(InlineAsset.model_validate(asset).model_dump(by_alias=False))
    return serialized


def _merge_inline_assets(*asset_groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for group in asset_groups:
        for asset in group:
            cid = str(asset.get("cid") or "").strip()
            if cid:
                merged[cid] = asset
    return list(merged.values())


def _serialize_attachments(
    attachments: Optional[list[EmailAttachment | dict[str, Any]]],
) -> list[dict[str, Any]]:
    if not attachments:
        return []
    serialized: list[dict[str, Any]] = []
    for attachment in attachments:
        if isinstance(attachment, EmailAttachment):
            serialized.append(attachment.model_dump(by_alias=False))
        else:
            serialized.append(EmailAttachment.model_validate(attachment).model_dump(by_alias=False))
    return serialized

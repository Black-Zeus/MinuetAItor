from __future__ import annotations

import base64
import json
import logging
import os
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session, joinedload

from db.minio_client import get_minio_client
from db.redis import get_redis
from models.ai_profiles import AiProfile
from models.clients import Client
from models.participant import Participant
from models.projects import Project
from models.record_statuses import RecordStatus
from models.record_version_participant import RecordVersionParticipant
from models.record_versions import RecordVersion
from models.records import Record
from models.user import User
from models.user_client_acl import UserClientAcl, UserClientAclPermission
from models.user_project_acl import UserProjectACL, UserProjectPermission
from services.email_queue import queue_templated_email

logger = logging.getLogger(__name__)

PASSWORD_TOKEN_PREFIX = "password-reset"
DEFAULT_PASSWORD_TOKEN_TTL_MINUTES = 30
DEFAULT_APPROVAL_DAYS = 3
DEFAULT_REMINDER_HOURS = 24
REMINDER_TARGET_STATUSES = {"ready-for-edit", "pending", "preview"}


@dataclass(frozen=True)
class PasswordResetTokenData:
    token: str
    otp_code: str
    expires_at: datetime
    ttl_minutes: int
    purpose: str
    user_id: str
    email: str
    request_id: str
    request_origin: str
    request_ip: str
    request_ua: str


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _env(name: str, default: str) -> str:
    value = os.environ.get(name)
    if value is None:
        return default
    value = value.strip()
    return value or default


def _frontend_base_url() -> str:
    return _env("FRONTEND_BASE_URL", _env("APP_BASE_URL", "http://localhost:5173")).rstrip("/")


def _login_url() -> str:
    return _env("FRONTEND_LOGIN_URL", f"{_frontend_base_url()}/login")


def _support_name() -> str:
    return _env("SUPPORT_NAME", _env("DEVELOPER_NAME", "Soporte MinuetAItor"))


def _approval_days() -> int:
    raw = _env("MINUTE_APPROVAL_DAYS", str(DEFAULT_APPROVAL_DAYS))
    try:
        value = int(raw)
        return value if value > 0 else DEFAULT_APPROVAL_DAYS
    except ValueError:
        return DEFAULT_APPROVAL_DAYS


def _password_ttl_minutes() -> int:
    raw = _env("PASSWORD_RESET_TTL_MINUTES", str(DEFAULT_PASSWORD_TOKEN_TTL_MINUTES))
    try:
        value = int(raw)
        return value if value > 0 else DEFAULT_PASSWORD_TOKEN_TTL_MINUTES
    except ValueError:
        return DEFAULT_PASSWORD_TOKEN_TTL_MINUTES


def _safe_email(value: Any) -> str | None:
    email = str(value or "").strip()
    return email or None


def _format_dt(value: datetime | None) -> str:
    if value is None:
        return "-"
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M")


def _format_record_datetime(record: Record | None) -> str:
    if record is None or record.document_date is None:
        return "-"
    pieces = [str(record.document_date)]
    if getattr(record, "scheduled_start_time", None):
        pieces.append(record.scheduled_start_time.strftime("%H:%M"))
    if getattr(record, "scheduled_end_time", None):
        pieces.append(record.scheduled_end_time.strftime("%H:%M"))
    if len(pieces) == 3:
        return f"{pieces[0]} {pieces[1]}-{pieces[2]}"
    if len(pieces) == 2:
        return f"{pieces[0]} {pieces[1]}"
    return pieces[0]


def _human_size(num_bytes: int | None) -> str:
    size = int(num_bytes or 0)
    if size <= 0:
        return "-"
    units = ["B", "KB", "MB", "GB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f} {unit}" if unit != "B" else f"{int(value)} {unit}"
        value /= 1024.0
    return f"{size} B"


def _request_meta(
    *,
    request_origin: str | None = None,
    request_ip: str | None = None,
    request_ua: str | None = None,
    request_id: str | None = None,
) -> dict[str, str]:
    return {
        "request_id": request_id or str(uuid.uuid4()),
        "request_origin": request_origin or "backend",
        "request_ip": request_ip or "-",
        "request_ua": request_ua or "-",
    }


def _password_reset_key(token: str) -> str:
    return f"{PASSWORD_TOKEN_PREFIX}:{token}"


def _minute_url(record_id: str) -> str:
    return f"{_frontend_base_url()}/minutes/process/{record_id}"


def _reset_url(token: str) -> str:
    configured = _env("FRONTEND_RESET_PASSWORD_URL", "")
    if configured:
        return configured.format(token=token) if "{token}" in configured else configured
    return f"{_frontend_base_url()}/reset-password?token={token}"


def _access_url(scope: str, scope_id: str) -> str:
    base = _frontend_base_url()
    if scope == "project":
        return f"{base}/projects"
    if scope == "client":
        return f"{base}/clients"
    return f"{base}/teams"


def _clean_list(items: list[str]) -> list[str]:
    seen: set[str] = set()
    clean: list[str] = []
    for item in items:
        value = str(item or "").strip().lower()
        if not value or value in seen:
            continue
        seen.add(value)
        clean.append(value)
    return clean


def _dedupe_preserve(items: list[str]) -> list[str]:
    seen: set[str] = set()
    clean: list[str] = []
    for item in items:
        value = str(item or "").strip()
        if not value:
            continue
        key = value.casefold()
        if key in seen:
            continue
        seen.add(key)
        clean.append(value)
    return clean


def _user_display_name(user: User | None) -> str:
    if user is None:
        return "Usuario"
    return str(user.full_name or user.username or user.email or "Usuario").strip()


def _record_with_relations(db: Session, record_id: str) -> Record | None:
    return (
        db.query(Record)
        .options(
            joinedload(Record.client),
            joinedload(Record.project).joinedload(Project.client),
            joinedload(Record.prepared_by_user).joinedload(User.profile),
            joinedload(Record.created_by_user),
            joinedload(Record.ai_profile).joinedload(AiProfile.category),
            joinedload(Record.status),
        )
        .filter(Record.id == record_id, Record.deleted_at.is_(None))
        .first()
    )


def _record_version_with_participants(db: Session, version_id: str | None) -> RecordVersion | None:
    if not version_id:
        return None
    return (
        db.query(RecordVersion)
        .options(
            joinedload(RecordVersion.participants).joinedload(RecordVersionParticipant.participant).joinedload(Participant.emails),
            joinedload(RecordVersion.published_by_user),
        )
        .filter(RecordVersion.id == version_id, RecordVersion.deleted_at.is_(None))
        .first()
    )


def _extract_summary_from_content(content: dict[str, Any] | None) -> tuple[str, list[str]]:
    payload = content if isinstance(content, dict) else {}

    summary_candidates = [
        payload.get("executiveSummary"),
        payload.get("summary"),
        payload.get("meetingSummary"),
        payload.get("introSnippet"),
    ]
    summary = next((str(item).strip() for item in summary_candidates if str(item or "").strip()), "-")

    points: list[str] = []

    if isinstance(payload.get("scopeSections"), list):
        for section in payload["scopeSections"]:
            if not isinstance(section, dict):
                continue
            title = str(section.get("title") or section.get("name") or "").strip()
            if title:
                points.append(title)
            for topic in section.get("topicsList", []) or []:
                text = str(topic.get("text") or "").strip() if isinstance(topic, dict) else str(topic).strip()
                if text:
                    points.append(text)
    elif isinstance(payload.get("scope"), dict):
        for section in payload["scope"].get("sections", []) or []:
            if not isinstance(section, dict):
                continue
            title = str(section.get("title") or section.get("name") or "").strip()
            if title:
                points.append(title)

    deduped = _dedupe_preserve(points)
    return summary, deduped[:3]


def _recipient_emails_for_version(record: Record, version: RecordVersion | None) -> list[str]:
    emails: list[str] = []

    if record.prepared_by_user and record.prepared_by_user.email:
        emails.append(record.prepared_by_user.email)
    if record.created_by_user and record.created_by_user.email:
        emails.append(record.created_by_user.email)

    if version:
        for participant in version.participants or []:
            if participant.email:
                emails.append(participant.email)
            model_participant = getattr(participant, "participant", None)
            if model_participant:
                primary_emails = [
                    rel.email
                    for rel in (model_participant.emails or [])
                    if rel.deleted_at is None and rel.is_active and rel.email
                ]
                emails.extend(primary_emails)

    return _clean_list(emails)


def _recipient_emails_from_content(
    content: dict[str, Any] | None,
    *,
    selected_ids: list[str] | None = None,
) -> tuple[list[str], list[str]]:
    payload = content if isinstance(content, dict) else {}
    raw_participants = payload.get("participants") if isinstance(payload.get("participants"), list) else []
    selected_lookup = {str(item).strip() for item in (selected_ids or []) if str(item).strip()}

    to: list[str] = []
    cc: list[str] = []

    for raw in raw_participants:
        if not isinstance(raw, dict):
            continue
        editor_id = str(raw.get("id") or "").strip()
        if selected_lookup and editor_id not in selected_lookup:
            continue

        email = _safe_email(raw.get("email"))
        if not email:
            continue

        participant_type = str(raw.get("type") or "").strip().lower()
        if participant_type == "copy":
            cc.append(email)
        else:
            to.append(email)

    return _clean_list(to), _clean_list(cc)


def _minute_pdf_attachment(record_id: str, *, published: bool = False) -> dict[str, str] | None:
    bucket = "minuetaitor-published" if published else "minuetaitor-draft"
    key = f"published/{record_id}/final.pdf" if published else f"drafts/{record_id}/draft_current.pdf"

    minio = get_minio_client()
    try:
        obj = minio.get_object(bucket, key)
        pdf_bytes = obj.read()
        obj.close()
        obj.release_conn()
    except Exception:
        return None

    if not pdf_bytes:
        return None

    return {
        "filename": f"minute-{record_id}.pdf",
        "mime_type": "application/pdf",
        "content_base64": base64.b64encode(pdf_bytes).decode("ascii"),
    }


async def _safe_queue_template(
    *,
    to: list[str],
    cc: list[str] | None = None,
    template_id: str,
    context: dict[str, Any],
    subject: str | None = None,
    attachments: list[dict[str, Any]] | None = None,
) -> bool:
    recipients = _clean_list(to)
    if not recipients:
        logger.info("Notification skipped | template=%s reason=no_recipients", template_id)
        return False

    try:
        await queue_templated_email(
            to=recipients,
            cc=_clean_list(cc or []) or None,
            template_id=template_id,
            template_context=context,
            subject=subject,
            attachments=attachments,
        )
        return True
    except Exception as exc:
        logger.warning(
            "Notification enqueue failed | template=%s recipients=%s err=%s",
            template_id,
            recipients,
            exc,
        )
        return False


async def create_password_reset_token(
    *,
    user: User,
    purpose: str,
    request_origin: str | None = None,
    request_ip: str | None = None,
    request_ua: str | None = None,
) -> PasswordResetTokenData:
    email = _safe_email(user.email)
    if not email:
        raise ValueError("El usuario no tiene email para enviar reset/password setup")

    token = secrets.token_urlsafe(32)
    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    ttl_minutes = _password_ttl_minutes()
    expires_at = _utcnow() + timedelta(minutes=ttl_minutes)
    meta = _request_meta(
        request_origin=request_origin,
        request_ip=request_ip,
        request_ua=request_ua,
    )

    payload = {
        "user_id": user.id,
        "email": email,
        "purpose": purpose,
        "otp_code": otp_code,
        "expires_at": expires_at.isoformat(),
        **meta,
    }
    redis = get_redis()
    await redis.setex(_password_reset_key(token), ttl_minutes * 60, json.dumps(payload))

    return PasswordResetTokenData(
        token=token,
        otp_code=otp_code,
        expires_at=expires_at,
        ttl_minutes=ttl_minutes,
        purpose=purpose,
        user_id=user.id,
        email=email,
        request_id=meta["request_id"],
        request_origin=meta["request_origin"],
        request_ip=meta["request_ip"],
        request_ua=meta["request_ua"],
    )


async def get_password_reset_token(token: str) -> dict[str, Any] | None:
    redis = get_redis()
    raw = await redis.get(_password_reset_key(token))
    if not raw:
        return None
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    payload["token"] = token
    return payload


async def consume_password_reset_token(token: str) -> dict[str, Any] | None:
    payload = await get_password_reset_token(token)
    if payload is None:
        return None
    redis = get_redis()
    await redis.delete(_password_reset_key(token))
    return payload


async def enqueue_account_created_email(
    db: Session,
    user_id: str,
    *,
    request_origin: str | None = None,
    request_ip: str | None = None,
    request_ua: str | None = None,
) -> bool:
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user or not user.email:
        return False

    token_data = await create_password_reset_token(
        user=user,
        purpose="account_created",
        request_origin=request_origin,
        request_ip=request_ip,
        request_ua=request_ua,
    )

    context = {
        "SUPPORT_NAME": _support_name(),
        "USER_DISPLAY_NAME": _user_display_name(user),
        "USER_IDENTIFIER": user.email or user.username,
        "OTP_CODE": token_data.otp_code,
        "OTP_TTL_MINUTES": token_data.ttl_minutes,
        "OTP_EXPIRES_AT": _format_dt(token_data.expires_at),
        "RESET_URL": _reset_url(token_data.token),
        "LOGIN_URL": _login_url(),
        "REQUEST_ID": token_data.request_id,
        "REQUEST_ORIGIN": token_data.request_origin,
        "REQUEST_IP": token_data.request_ip,
        "REQUEST_UA": token_data.request_ua,
    }
    return await _safe_queue_template(
        to=[user.email],
        template_id="account_created_set_password",
        context=context,
    )


async def enqueue_recover_password_email(
    db: Session,
    email: str,
    *,
    request_origin: str | None = None,
    request_ip: str | None = None,
    request_ua: str | None = None,
) -> bool:
    user = (
        db.query(User)
        .filter(
            User.deleted_at.is_(None),
            User.is_active.is_(True),
            User.email == email.strip().lower(),
        )
        .first()
    )
    if not user or not user.email:
        return False

    token_data = await create_password_reset_token(
        user=user,
        purpose="recover_password",
        request_origin=request_origin,
        request_ip=request_ip,
        request_ua=request_ua,
    )

    context = {
        "SUPPORT_NAME": _support_name(),
        "USER_IDENTIFIER": user.email or user.username,
        "OTP_CODE": token_data.otp_code,
        "OTP_TTL_MINUTES": token_data.ttl_minutes,
        "OTP_EXPIRES_AT": _format_dt(token_data.expires_at),
        "RESET_URL": _reset_url(token_data.token),
        "LOGIN_URL": _login_url(),
        "REQUEST_ID": token_data.request_id,
        "REQUEST_ORIGIN": token_data.request_origin,
        "REQUEST_IP": token_data.request_ip,
        "REQUEST_UA": token_data.request_ua,
    }
    return await _safe_queue_template(
        to=[user.email],
        template_id="recoverPass",
        context=context,
    )


async def enqueue_ai_processed_ready_email(
    db: Session,
    record_id: str,
    *,
    ai_output: dict[str, Any] | None = None,
    actor_user: User | None = None,
) -> bool:
    record = _record_with_relations(db, record_id)
    if not record:
        return False

    summary, notes = _extract_summary_from_content(ai_output)
    recipients = _recipient_emails_for_version(record, None)
    prepared_by = _user_display_name(record.prepared_by_user)
    profile = getattr(record, "ai_profile", None)

    context = {
        "MEETING_TITLE": record.title,
        "MEETING_DATETIME": _format_record_datetime(record),
        "CLIENT_NAME": getattr(record.client, "name", "-"),
        "PROJECT_NAME": getattr(record.project, "name", "-"),
        "MINUTE_ID": record.id,
        "DRAFT_VERSION": max(int(record.latest_version_num or 1), 1),
        "MEETING_SUMMARY": summary,
        "AI_PROFILE_NAME": getattr(profile, "name", "-"),
        "AI_PROFILE_CATEGORY": getattr(getattr(profile, "category", None), "name", "Sin categoria"),
        "AI_PROCESSED_AT": _format_dt(_utcnow()),
        "AI_ENGINE": _env("OPENAI_MODEL", "gpt-4o"),
        "AI_CONFIDENCE": _env("MINUTE_AI_CONFIDENCE_DEFAULT", "90"),
        "AI_LATENCY_MS": _env("MINUTE_AI_LATENCY_DEFAULT_MS", "0"),
        "AI_RUN_ID": str(getattr(ai_output or {}, "get", lambda *_: None)("run_id") or getattr(record, "id", "-")),
        "AI_NOTE_1": notes[0] if len(notes) > 0 else "Revisar redaccion general.",
        "AI_NOTE_2": notes[1] if len(notes) > 1 else "Validar participantes y acuerdos.",
        "AI_NOTE_3": notes[2] if len(notes) > 2 else "Confirmar fechas y compromisos.",
        "EDIT_URL": _minute_url(record.id),
        "VIEW_URL": _minute_url(record.id),
        "ISSUED_AT": _format_dt(_utcnow()),
        "REQUEST_ID": str(uuid.uuid4()),
        "REQUEST_ORIGIN": "internal-worker",
        "ACTOR_USER": _user_display_name(actor_user) if actor_user else prepared_by,
    }
    return await _safe_queue_template(
        to=recipients,
        template_id="ai_processed_ready_for_manual_review",
        context=context,
    )


async def enqueue_minute_review_email(
    db: Session,
    record_id: str,
    *,
    content: dict[str, Any] | None = None,
    subject: str | None = None,
    body_note: str | None = None,
    selected_participant_ids: list[str] | None = None,
    attach_pdf: bool = True,
) -> bool:
    record = _record_with_relations(db, record_id)
    if not record:
        return False
    version = _record_version_with_participants(db, record.active_version_id)
    to_recipients, cc_recipients = _recipient_emails_from_content(
        content,
        selected_ids=selected_participant_ids,
    )
    recipients = (
        to_recipients
        if selected_participant_ids
        else (to_recipients or _recipient_emails_for_version(record, version))
    )

    summary, points = _extract_summary_from_content(content)
    attendee_names = [p.display_name for p in (version.participants or [])] if version else []
    normalized_note = str(body_note or "").strip()
    attachment = _minute_pdf_attachment(record_id) if attach_pdf else None
    context = {
        "MEETING_TITLE": record.title,
        "MEETING_DATETIME": _format_record_datetime(record),
        "CLIENT_NAME": getattr(record.client, "name", "-"),
        "PROJECT_NAME": getattr(record.project, "name", "-"),
        "ATTENDEES_INLINE": ", ".join(attendee_names[:8]) if attendee_names else _user_display_name(record.prepared_by_user),
        "MEETING_SUMMARY": summary if summary != "-" else (record.intro_snippet or "Minuta lista para revision."),
        "KEY_POINT_1": points[0] if len(points) > 0 else "Validar acuerdos y responsables.",
        "KEY_POINT_2": points[1] if len(points) > 1 else "Confirmar participantes y observaciones.",
        "KEY_POINT_3": points[2] if len(points) > 2 else "Responder dentro del plazo definido.",
        "ATTACHMENT_NAME": attachment["filename"] if attachment else "Documento disponible en plataforma",
        "ATTACHMENT_TYPE": "PDF" if attachment else "Enlace",
        "ATTACHMENT_SIZE": _human_size(len(base64.b64decode(attachment["content_base64"]))) if attachment else "-",
        "MINUTE_ID": record.id,
        "MINUTE_VERSION": getattr(version, "version_num", record.latest_version_num or 1),
        "APPROVAL_DAYS": _approval_days(),
        "MINUTE_URL": _minute_url(record.id),
        "ISSUED_AT": _format_dt(_utcnow()),
        "REQUEST_ID": str(uuid.uuid4()),
        "REQUEST_ORIGIN": "minutes.transition.pending-preview",
        "HAS_CUSTOM_MESSAGE": "true" if normalized_note else "",
        "CUSTOM_MESSAGE": normalized_note or "",
    }
    return await _safe_queue_template(
        to=recipients,
        cc=cc_recipients,
        template_id="sendMinute",
        context=context,
        subject=subject,
        attachments=[attachment] if attachment else None,
    )


async def enqueue_minute_officialized_email(db: Session, record_id: str, *, actor_user: User | None = None) -> bool:
    record = _record_with_relations(db, record_id)
    if not record:
        return False
    version = _record_version_with_participants(db, record.active_version_id)
    recipients = _recipient_emails_for_version(record, version)
    approvers = [p.display_name for p in (version.participants or []) if p.role == "required"] if version else []

    context = {
        "MEETING_TITLE": record.title,
        "OFFICIAL_STATUS": "oficializada",
        "MINUTE_ID": record.id,
        "MINUTE_VERSION": getattr(version, "version_num", record.latest_version_num or 1),
        "OFFICIALIZED_AT": _format_dt(_utcnow()),
        "APPROVAL_METHOD": "flujo editorial",
        "APPROVAL_DAYS": _approval_days(),
        "APPROVERS_INLINE": ", ".join(approvers[:8]) if approvers else _user_display_name(record.prepared_by_user),
        "DOCUMENT_HASH_ALGO": "sha256",
        "DOCUMENT_HASH": "-",
        "ATTACHMENT_NAME": f"minute-{record.id}-official.pdf",
        "ATTACHMENT_TYPE": "PDF",
        "ATTACHMENT_SIZE": "-",
        "MINUTE_URL": _minute_url(record.id),
        "ISSUED_AT": _format_dt(_utcnow()),
        "REQUEST_ID": str(uuid.uuid4()),
        "ACTOR_USER": _user_display_name(actor_user) if actor_user else _user_display_name(record.prepared_by_user),
    }
    return await _safe_queue_template(
        to=recipients,
        template_id="minute_officialized_approved",
        context=context,
    )


def _client_acl_with_relations(db: Session, user_id: str, client_id: str) -> UserClientAcl | None:
    return (
        db.query(UserClientAcl)
        .options(
            joinedload(UserClientAcl.user),
            joinedload(UserClientAcl.client),
            joinedload(UserClientAcl.created_by_user),
            joinedload(UserClientAcl.updated_by_user),
            joinedload(UserClientAcl.deleted_by_user),
        )
        .filter(
            UserClientAcl.user_id == user_id,
            UserClientAcl.client_id == client_id,
        )
        .first()
    )


def _project_acl_with_relations(db: Session, user_id: str, project_id: str) -> UserProjectACL | None:
    return (
        db.query(UserProjectACL)
        .options(
            joinedload(UserProjectACL.user),
            joinedload(UserProjectACL.project).joinedload(Project.client),
            joinedload(UserProjectACL.created_by_user),
            joinedload(UserProjectACL.updated_by_user),
            joinedload(UserProjectACL.deleted_by_user),
        )
        .filter(
            UserProjectACL.user_id == user_id,
            UserProjectACL.project_id == project_id,
        )
        .first()
    )


def _confidential_client_owner_emails(db: Session, client_id: str) -> list[str]:
    rows = (
        db.query(UserClientAcl)
        .options(joinedload(UserClientAcl.user))
        .filter(
            UserClientAcl.client_id == client_id,
            UserClientAcl.deleted_at.is_(None),
            UserClientAcl.is_active.is_(True),
            UserClientAcl.permission == UserClientAclPermission.owner,
        )
        .all()
    )
    return _clean_list([row.user.email for row in rows if row.user and row.user.email])


def _confidential_project_owner_emails(db: Session, project_id: str) -> list[str]:
    rows = (
        db.query(UserProjectACL)
        .options(joinedload(UserProjectACL.user))
        .filter(
            UserProjectACL.project_id == project_id,
            UserProjectACL.deleted_at.is_(None),
            UserProjectACL.is_active.is_(True),
            UserProjectACL.permission == UserProjectPermission.owner,
        )
        .all()
    )
    return _clean_list([row.user.email for row in rows if row.user and row.user.email])


async def enqueue_confidential_client_acl_notifications(
    db: Session,
    *,
    user_id: str,
    client_id: str,
    action: str,
    actor_user_id: str | None,
    reason: str | None = None,
) -> dict[str, bool]:
    acl = _client_acl_with_relations(db, user_id, client_id)
    client = db.query(Client).filter(Client.id == client_id, Client.deleted_at.is_(None)).first()
    if not client or not client.is_confidential or not acl or not acl.user:
        return {"owner_request": False, "decision": False, "scope_change": False}

    actor = db.query(User).filter(User.id == actor_user_id, User.deleted_at.is_(None)).first() if actor_user_id else None
    owner_emails = _confidential_client_owner_emails(db, client_id)
    target_email = _safe_email(getattr(acl.user, "email", None))
    owner_name = _user_display_name(actor)
    access_scope = "Cliente"
    access_url = _access_url("client", client_id)
    request_id = str(uuid.uuid4())

    base_context = {
        "REQUESTED_BY_NAME": _user_display_name(actor),
        "REQUESTED_BY_EMAIL": _safe_email(getattr(actor, "email", None)) or "-",
        "TARGET_USER_NAME": _user_display_name(acl.user),
        "TARGET_USER_EMAIL": target_email or "-",
        "ACCESS_LEVEL": str(getattr(acl.permission, "value", acl.permission)),
        "PERMISSIONS_SCOPE": access_scope,
        "REQUEST_REASON": reason or "Cambio de acceso confidencial.",
        "CLIENT_NAME": client.name,
        "CLIENT_ID": client.id,
        "PROJECT_NAME": "-",
        "PROJECT_ID": "-",
        "MINUTE_TITLE": "-",
        "MINUTE_ID": "-",
        "MINUTE_VERSION": "-",
        "REQUEST_NOTES": reason or "-",
        "APPROVE_URL": access_url,
        "REJECT_URL": access_url,
        "ACCESS_REQUEST_ID": request_id,
        "ISSUED_AT": _format_dt(_utcnow()),
        "REQUEST_ID": request_id,
        "REQUEST_ORIGIN": "user-client-acl",
    }

    owner_request = await _safe_queue_template(
        to=owner_emails,
        template_id="sendOwerConfidential",
        context=base_context,
    )

    if action == "revoked":
        decision_template = "responseDeniedConfidential"
        decision_context = {
            "OWNER_NAME": owner_name,
            "OWNER_EMAIL": _safe_email(getattr(actor, "email", None)) or "-",
            "TARGET_USER_NAME": _user_display_name(acl.user),
            "TARGET_USER_EMAIL": target_email or "-",
            "ACCESS_LEVEL": str(getattr(acl.permission, "value", acl.permission)),
            "PERMISSIONS_SCOPE": access_scope,
            "CLIENT_NAME": client.name,
            "PROJECT_NAME": "-",
            "MINUTE_TITLE": "-",
            "REJECT_REASON": reason or "Acceso confidencial revocado o rechazado.",
            "ACCESS_REQUEST_ID": request_id,
            "DECISION_AT": _format_dt(_utcnow()),
            "ACCESS_AUDIT_URL": access_url,
            "ISSUED_AT": _format_dt(_utcnow()),
            "REQUEST_ID": request_id,
            "REQUEST_ORIGIN": "user-client-acl",
        }
    else:
        decision_template = "responseApproveConfidential"
        decision_context = {
            "OWNER_NAME": owner_name,
            "OWNER_EMAIL": _safe_email(getattr(actor, "email", None)) or "-",
            "TARGET_USER_NAME": _user_display_name(acl.user),
            "TARGET_USER_EMAIL": target_email or "-",
            "ACCESS_LEVEL": str(getattr(acl.permission, "value", acl.permission)),
            "PERMISSIONS_SCOPE": access_scope,
            "CLIENT_NAME": client.name,
            "PROJECT_NAME": "-",
            "MINUTE_TITLE": "-",
            "ACCESS_REQUEST_ID": request_id,
            "DECISION_AT": _format_dt(_utcnow()),
            "ACCESS_AUDIT_URL": access_url,
            "ISSUED_AT": _format_dt(_utcnow()),
            "REQUEST_ID": request_id,
            "REQUEST_ORIGIN": "user-client-acl",
        }

    decision = await _safe_queue_template(
        to=[email for email in [target_email, _safe_email(getattr(actor, "email", None))] if email],
        template_id=decision_template,
        context=decision_context,
    )

    scope_change = await _safe_queue_template(
        to=[target_email] if target_email else [],
        template_id="access_granted_revoked_scope",
        context={
            "ACCESS_ACTION": "Revocado" if action == "revoked" else "Otorgado",
            "ROLE_OR_PERMISSION": str(getattr(acl.permission, "value", acl.permission)),
            "TARGET_USER": _user_display_name(acl.user),
            "ACTOR_USER": _user_display_name(actor),
            "CHANGED_AT": _format_dt(_utcnow()),
            "SCOPE_TYPE": access_scope,
            "DATA_CLASSIFICATION": "confidential",
            "CLIENT_NAME": client.name,
            "PROJECT_NAME": "-",
            "MINUTE_ID": "-",
            "MINUTE_TITLE": "-",
            "REASON": reason or "-",
            "ACCESS_URL": access_url,
            "AUDIT_EVENT_ID": request_id,
            "REQUEST_ORIGIN": "user-client-acl",
            "REQUEST_IP": "-",
            "REQUEST_UA": "-",
        },
    )

    return {
        "owner_request": owner_request,
        "decision": decision,
        "scope_change": scope_change,
    }


async def enqueue_confidential_project_acl_notifications(
    db: Session,
    *,
    user_id: str,
    project_id: str,
    action: str,
    actor_user_id: str | None,
    reason: str | None = None,
) -> dict[str, bool]:
    acl = _project_acl_with_relations(db, user_id, project_id)
    project = db.query(Project).options(joinedload(Project.client)).filter(Project.id == project_id, Project.deleted_at.is_(None)).first()
    if not project or not project.is_confidential or not acl or not acl.user:
        return {"owner_request": False, "decision": False, "scope_change": False}

    actor = db.query(User).filter(User.id == actor_user_id, User.deleted_at.is_(None)).first() if actor_user_id else None
    owner_emails = _confidential_project_owner_emails(db, project_id)
    target_email = _safe_email(getattr(acl.user, "email", None))
    owner_name = _user_display_name(actor)
    access_scope = "Proyecto"
    access_url = _access_url("project", project_id)
    request_id = str(uuid.uuid4())

    base_context = {
        "REQUESTED_BY_NAME": _user_display_name(actor),
        "REQUESTED_BY_EMAIL": _safe_email(getattr(actor, "email", None)) or "-",
        "TARGET_USER_NAME": _user_display_name(acl.user),
        "TARGET_USER_EMAIL": target_email or "-",
        "ACCESS_LEVEL": str(getattr(acl.permission, "value", acl.permission)),
        "PERMISSIONS_SCOPE": access_scope,
        "REQUEST_REASON": reason or "Cambio de acceso confidencial.",
        "CLIENT_NAME": getattr(project.client, "name", "-"),
        "CLIENT_ID": getattr(project.client, "id", "-"),
        "PROJECT_NAME": project.name,
        "PROJECT_ID": project.id,
        "MINUTE_TITLE": "-",
        "MINUTE_ID": "-",
        "MINUTE_VERSION": "-",
        "REQUEST_NOTES": reason or "-",
        "APPROVE_URL": access_url,
        "REJECT_URL": access_url,
        "ACCESS_REQUEST_ID": request_id,
        "ISSUED_AT": _format_dt(_utcnow()),
        "REQUEST_ID": request_id,
        "REQUEST_ORIGIN": "user-project-acl",
    }

    owner_request = await _safe_queue_template(
        to=owner_emails,
        template_id="sendOwerConfidential",
        context=base_context,
    )

    if action == "revoked":
        decision_template = "responseDeniedConfidential"
        decision_context = {
            "OWNER_NAME": owner_name,
            "OWNER_EMAIL": _safe_email(getattr(actor, "email", None)) or "-",
            "TARGET_USER_NAME": _user_display_name(acl.user),
            "TARGET_USER_EMAIL": target_email or "-",
            "ACCESS_LEVEL": str(getattr(acl.permission, "value", acl.permission)),
            "PERMISSIONS_SCOPE": access_scope,
            "CLIENT_NAME": getattr(project.client, "name", "-"),
            "PROJECT_NAME": project.name,
            "MINUTE_TITLE": "-",
            "REJECT_REASON": reason or "Acceso confidencial revocado o rechazado.",
            "ACCESS_REQUEST_ID": request_id,
            "DECISION_AT": _format_dt(_utcnow()),
            "ACCESS_AUDIT_URL": access_url,
            "ISSUED_AT": _format_dt(_utcnow()),
            "REQUEST_ID": request_id,
            "REQUEST_ORIGIN": "user-project-acl",
        }
    else:
        decision_template = "responseApproveConfidential"
        decision_context = {
            "OWNER_NAME": owner_name,
            "OWNER_EMAIL": _safe_email(getattr(actor, "email", None)) or "-",
            "TARGET_USER_NAME": _user_display_name(acl.user),
            "TARGET_USER_EMAIL": target_email or "-",
            "ACCESS_LEVEL": str(getattr(acl.permission, "value", acl.permission)),
            "PERMISSIONS_SCOPE": access_scope,
            "CLIENT_NAME": getattr(project.client, "name", "-"),
            "PROJECT_NAME": project.name,
            "MINUTE_TITLE": "-",
            "ACCESS_REQUEST_ID": request_id,
            "DECISION_AT": _format_dt(_utcnow()),
            "ACCESS_AUDIT_URL": access_url,
            "ISSUED_AT": _format_dt(_utcnow()),
            "REQUEST_ID": request_id,
            "REQUEST_ORIGIN": "user-project-acl",
        }

    decision = await _safe_queue_template(
        to=[email for email in [target_email, _safe_email(getattr(actor, "email", None))] if email],
        template_id=decision_template,
        context=decision_context,
    )

    scope_change = await _safe_queue_template(
        to=[target_email] if target_email else [],
        template_id="access_granted_revoked_scope",
        context={
            "ACCESS_ACTION": "Revocado" if action == "revoked" else "Otorgado",
            "ROLE_OR_PERMISSION": str(getattr(acl.permission, "value", acl.permission)),
            "TARGET_USER": _user_display_name(acl.user),
            "ACTOR_USER": _user_display_name(actor),
            "CHANGED_AT": _format_dt(_utcnow()),
            "SCOPE_TYPE": access_scope,
            "DATA_CLASSIFICATION": "confidential",
            "CLIENT_NAME": getattr(project.client, "name", "-"),
            "PROJECT_NAME": project.name,
            "MINUTE_ID": "-",
            "MINUTE_TITLE": "-",
            "REASON": reason or "-",
            "ACCESS_URL": access_url,
            "AUDIT_EVENT_ID": request_id,
            "REQUEST_ORIGIN": "user-project-acl",
            "REQUEST_IP": "-",
            "REQUEST_UA": "-",
        },
    )

    return {
        "owner_request": owner_request,
        "decision": decision,
        "scope_change": scope_change,
    }


async def enqueue_pending_publication_reminders(db: Session) -> int:
    threshold = _utcnow() - timedelta(hours=DEFAULT_REMINDER_HOURS)
    records = (
        db.query(Record)
        .options(
            joinedload(Record.client),
            joinedload(Record.project),
            joinedload(Record.prepared_by_user),
            joinedload(Record.created_by_user),
            joinedload(Record.status),
        )
        .join(RecordStatus, RecordStatus.id == Record.status_id)
        .filter(
            Record.deleted_at.is_(None),
            RecordStatus.code.in_(REMINDER_TARGET_STATUSES),
            Record.updated_at.is_not(None),
            Record.updated_at <= threshold,
        )
        .all()
    )

    sent = 0
    for record in records:
        owner_email = _safe_email(getattr(record.prepared_by_user, "email", None)) or _safe_email(getattr(record.created_by_user, "email", None))
        if not owner_email:
            continue
        status_code = getattr(record.status, "code", "pending")
        context = {
            "CURRENT_STATUS": status_code,
            "MEETING_TITLE": record.title,
            "MEETING_DATETIME": _format_record_datetime(record),
            "CLIENT_NAME": getattr(record.client, "name", "-"),
            "PROJECT_NAME": getattr(record.project, "name", "-"),
            "OWNER_USER": _user_display_name(record.prepared_by_user or record.created_by_user),
            "LAST_UPDATED_AT": _format_dt(record.updated_at),
            "RECOMMENDED_ACTION": "Revisar y publicar la minuta pendiente.",
            "MINUTE_DRAFT_URL": _minute_url(record.id),
            "ISSUED_AT": _format_dt(_utcnow()),
            "REQUEST_ID": str(uuid.uuid4()),
            "REMINDER_RULE": f"stale-minute>{DEFAULT_REMINDER_HOURS}h",
        }
        if await _safe_queue_template(
            to=[owner_email],
            template_id="reminder_processed_not_published",
            context=context,
        ):
            sent += 1

    return sent

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session
from starlette.requests import Request

from core.security import create_access_token, decode_access_token
from db.minio_client import get_minio_client
from db.redis import get_redis
from models.record_version_observation import RecordVersionObservation
from models.record_version_participant import RecordVersionParticipant
from models.record_versions import RecordVersion
from models.records import Record
from models.visitor_access_request import VisitorAccessRequest
from models.visitor_session import VisitorSession
from schemas.minute_views import (
    MinuteViewAccessRequestResponse,
    MinuteViewDetailResponse,
    MinuteViewObservationCreateResponse,
    MinuteViewObservationGroup,
    MinuteViewObservationItem,
    MinuteViewSessionResponse,
    MinuteViewVisitorInfo,
)
from schemas.minute_observations import (
    MinuteObservationItem,
    MinuteObservationListResponse,
    MinuteObservationResolveResponse,
)
from services.email_queue import queue_templated_email
from services.minutes_service import get_minute_detail, get_minute_versions
from utils.device import get_device_string
from utils.network import get_client_ip

VISITOR_SESSION_PREFIX = "visitor-session"
VISITOR_OTP_TTL_MINUTES = 30
VISITOR_SESSION_TTL_HOURS = 8


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _visitor_session_key(record_id: str, jti: str) -> str:
    return f"{VISITOR_SESSION_PREFIX}:{record_id}:{jti}"


def _normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def _hash_otp(record_id: str, email: str, otp_code: str) -> str:
    raw = f"{record_id}:{_normalize_email(email)}:{otp_code}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _resolve_record_or_404(db: Session, record_id: str) -> Record:
    record = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if not record:
        raise HTTPException(status_code=404, detail="Minuta no encontrada")
    return record


def _resolve_active_participant(db: Session, record: Record, email: str) -> RecordVersionParticipant:
    normalized = _normalize_email(email)
    if not record.active_version_id:
        raise HTTPException(status_code=409, detail="La minuta no tiene una versión activa disponible")

    participant = (
        db.query(RecordVersionParticipant)
        .filter(
            RecordVersionParticipant.record_version_id == record.active_version_id,
            RecordVersionParticipant.email.isnot(None),
            RecordVersionParticipant.email.ilike(normalized),
        )
        .order_by(RecordVersionParticipant.id.asc())
        .first()
    )
    if not participant:
        raise HTTPException(status_code=403, detail="El correo no pertenece a un participante invitado de esta minuta")
    return participant


def _build_visitor_info(participant: RecordVersionParticipant | None, email: str) -> MinuteViewVisitorInfo:
    return MinuteViewVisitorInfo(
        email=_normalize_email(email),
        display_name=getattr(participant, "display_name", None),
        role=(participant.role.value if hasattr(participant.role, "value") else getattr(participant, "role", None)),
    )


async def request_minute_view_otp(
    db: Session,
    *,
    record_id: str,
    email: str,
    request: Request,
) -> MinuteViewAccessRequestResponse:
    record = _resolve_record_or_404(db, record_id)
    participant = _resolve_active_participant(db, record, email)
    normalized_email = _normalize_email(email)

    otp_code = _generate_otp()
    expires_at = _utcnow() + timedelta(minutes=VISITOR_OTP_TTL_MINUTES)
    ip_v4, ip_v6 = get_client_ip(request)
    requester_ip = ip_v4 or ip_v6

    access_request = VisitorAccessRequest(
        id=str(uuid.uuid4()),
        record_id=record.id,
        record_version_id=record.active_version_id,
        record_version_participant_id=participant.id,
        email=normalized_email,
        otp_code_hash=_hash_otp(record.id, normalized_email, otp_code),
        otp_expires_at=expires_at,
        requester_ip=requester_ip,
        requester_user_agent=request.headers.get("User-Agent"),
        delivery_status="queued",
    )
    db.add(access_request)
    db.commit()

    await queue_templated_email(
        to=[normalized_email],
        template_id="minute_view_otp",
        template_context={
            "USER_DISPLAY_NAME": participant.display_name or normalized_email,
            "USER_EMAIL": normalized_email,
            "MINUTE_TITLE": record.title,
            "MINUTE_ID": record.id,
            "OTP_CODE": otp_code,
            "OTP_TTL_MINUTES": VISITOR_OTP_TTL_MINUTES,
        },
    )

    access_request.delivery_status = "sent"
    db.add(access_request)
    db.commit()

    return MinuteViewAccessRequestResponse(
        request_id=access_request.id,
        record_id=record.id,
        email=normalized_email,
        expires_at=expires_at.isoformat(),
        message="Se envió un código de acceso de un solo uso al correo indicado.",
    )


async def verify_minute_view_otp(
    db: Session,
    *,
    record_id: str,
    email: str,
    otp_code: str,
    request: Request,
) -> MinuteViewSessionResponse:
    record = _resolve_record_or_404(db, record_id)
    normalized_email = _normalize_email(email)
    otp_hash = _hash_otp(record_id, normalized_email, str(otp_code or "").strip())
    now = _utcnow()

    access_request = (
        db.query(VisitorAccessRequest)
        .filter(
            VisitorAccessRequest.record_id == record.id,
            VisitorAccessRequest.email == normalized_email,
            VisitorAccessRequest.consumed_at.is_(None),
        )
        .order_by(VisitorAccessRequest.created_at.desc())
        .first()
    )
    if not access_request:
        raise HTTPException(status_code=401, detail="No existe una solicitud de acceso activa para ese correo")

    access_request.attempt_count = int(access_request.attempt_count or 0) + 1
    access_request.last_attempt_at = now

    expires_at_utc = _as_utc(access_request.otp_expires_at)
    if (expires_at_utc and expires_at_utc < now) or access_request.otp_code_hash != otp_hash:
        db.add(access_request)
        db.commit()
        raise HTTPException(status_code=401, detail="El código es inválido o expiró")

    access_request.consumed_at = now
    db.add(access_request)

    participant = _resolve_active_participant(db, record, normalized_email)
    session_id = str(uuid.uuid4())
    jti = str(uuid.uuid4())
    expires_at = now + timedelta(hours=VISITOR_SESSION_TTL_HOURS)
    ip_v4, ip_v6 = get_client_ip(request)
    session = VisitorSession(
        id=session_id,
        record_id=record.id,
        record_version_participant_id=participant.id,
        access_request_id=access_request.id,
        email=normalized_email,
        jti=jti,
        ip_v4=ip_v4,
        ip_v6=ip_v6,
        user_agent=request.headers.get("User-Agent"),
        device=get_device_string(request.headers.get("User-Agent")),
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()

    token = create_access_token(
        subject=session.id,
        expires_delta=timedelta(hours=VISITOR_SESSION_TTL_HOURS),
        extra={
            "jti": jti,
            "type": "minute-visitor",
            "record_id": record.id,
            "email": normalized_email,
        },
    )
    redis = get_redis()
    ttl = int(timedelta(hours=VISITOR_SESSION_TTL_HOURS).total_seconds())
    await redis.setex(_visitor_session_key(record.id, jti), ttl, token)

    return MinuteViewSessionResponse(
        access_token=token,
        expires_in=ttl,
        expires_at=expires_at.isoformat(),
        record_id=record.id,
        visitor=_build_visitor_info(participant, normalized_email),
    )


async def get_current_visitor_session(token: str, record_id: str, db: Session) -> VisitorSession:
    payload = decode_access_token(token)
    if payload.get("type") != "minute-visitor":
        raise HTTPException(status_code=401, detail="Token de visitante inválido")

    token_record_id = str(payload.get("record_id") or "").strip()
    session_id = str(payload.get("sub") or "").strip()
    jti = str(payload.get("jti") or "").strip()
    if not token_record_id or token_record_id != record_id or not session_id or not jti:
        raise HTTPException(status_code=401, detail="El token no corresponde a la minuta solicitada")

    redis = get_redis()
    exists = await redis.exists(_visitor_session_key(record_id, jti))
    if not exists:
        raise HTTPException(status_code=401, detail="La sesión visitante expiró")

    session = (
        db.query(VisitorSession)
        .filter(
            VisitorSession.id == session_id,
            VisitorSession.record_id == record_id,
            VisitorSession.revoked_at.is_(None),
        )
        .first()
    )
    session_expires_at = _as_utc(session.expires_at) if session else None
    if not session or (session_expires_at and session_expires_at < _utcnow()):
        raise HTTPException(status_code=401, detail="La sesión visitante ya no está disponible")
    return session


async def logout_current_visitor_session(token: str, record_id: str, db: Session) -> None:
    session = await get_current_visitor_session(token, record_id, db)
    session.revoked_at = _utcnow()
    db.add(session)
    db.commit()

    payload = decode_access_token(token)
    redis = get_redis()
    await redis.delete(_visitor_session_key(record_id, str(payload.get("jti") or "")))


def _build_observation_groups(db: Session, record_id: str, active_version_id: str | None) -> list[MinuteViewObservationGroup]:
    versions_response = get_minute_versions(db, record_id)
    observations = (
        db.query(RecordVersionObservation)
        .filter(RecordVersionObservation.record_id == record_id)
        .order_by(RecordVersionObservation.created_at.desc(), RecordVersionObservation.id.desc())
        .all()
    )

    grouped: dict[str, list[MinuteViewObservationItem]] = {}
    for obs in observations:
        grouped.setdefault(str(obs.record_version_id), []).append(
            MinuteViewObservationItem(
                id=int(obs.id),
                record_version_id=str(obs.record_version_id),
                author_email=obs.author_email,
                author_name=obs.author_name,
                body=obs.body,
                status=obs.status,
                resolution_type=getattr(obs, "resolution_type", "none"),
                editor_comment=getattr(obs, "editor_comment", None),
                resolved_by=str(obs.resolved_by) if getattr(obs, "resolved_by", None) else None,
                resolution_note=obs.resolution_note,
                resolved_at=obs.resolved_at.isoformat() if obs.resolved_at else None,
                applied_in_version_id=str(obs.applied_in_version_id) if getattr(obs, "applied_in_version_id", None) else None,
                created_at=obs.created_at.isoformat() if obs.created_at else None,
                updated_at=obs.updated_at.isoformat() if obs.updated_at else None,
                is_current_version=str(obs.record_version_id) == str(active_version_id or ""),
            )
        )

    groups: list[MinuteViewObservationGroup] = []
    for version in versions_response.versions:
        key = str(version.version_id)
        groups.append(
            MinuteViewObservationGroup(
                record_version_id=key,
                version_num=int(version.version_num),
                version_label=version.version_label,
                is_active_version=key == str(active_version_id or ""),
                observations=grouped.get(key, []),
            )
        )
    return groups


def get_minute_view_detail(
    db: Session,
    *,
    record_id: str,
    visitor_session: VisitorSession,
) -> MinuteViewDetailResponse:
    detail = get_minute_detail(db, record_id)
    record = _resolve_record_or_404(db, record_id)
    participant = (
        db.query(RecordVersionParticipant)
        .filter(RecordVersionParticipant.id == visitor_session.record_version_participant_id)
        .first()
        if visitor_session.record_version_participant_id
        else None
    )
    versions = get_minute_versions(db, record_id).versions

    return MinuteViewDetailResponse(
        visitor=_build_visitor_info(participant, visitor_session.email),
        record=detail.record,
        content=detail.content,
        content_type=detail.content_type,
        versions=versions,
        observation_groups=_build_observation_groups(db, record_id, record.active_version_id),
        current_version_id=str(record.active_version_id) if record.active_version_id else None,
        current_version_num=int(record.latest_version_num) if record.latest_version_num else None,
    )


def get_minute_view_pdf_bytes(db: Session, *, record_id: str) -> tuple[bytes, str]:
    record = _resolve_record_or_404(db, record_id)
    if not record.active_version_id:
        raise HTTPException(status_code=404, detail="La minuta no tiene una versión activa con PDF")

    minio = get_minio_client()
    bucket = "minuetaitor-published"
    key = f"published/{record_id}/final.pdf"
    try:
        obj = minio.get_object(bucket, key)
        pdf_bytes = obj.read()
        obj.close()
        obj.release_conn()
    except Exception:
        try:
            bucket = "minuetaitor-draft"
            key = f"drafts/{record_id}/draft_current.pdf"
            obj = minio.get_object(bucket, key)
            pdf_bytes = obj.read()
            obj.close()
            obj.release_conn()
        except Exception as exc:
            raise HTTPException(status_code=404, detail="No existe un PDF disponible para esta minuta") from exc

    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="No existe un PDF disponible para esta minuta")
    return pdf_bytes, f"minute-{record_id}.pdf"


def create_minute_view_observation(
    db: Session,
    *,
    record_id: str,
    body: str,
    visitor_session: VisitorSession,
) -> MinuteViewObservationCreateResponse:
    record = _resolve_record_or_404(db, record_id)
    if not record.active_version_id:
        raise HTTPException(status_code=409, detail="La minuta no tiene una versión activa para registrar observaciones")

    participant = (
        db.query(RecordVersionParticipant)
        .filter(RecordVersionParticipant.id == visitor_session.record_version_participant_id)
        .first()
        if visitor_session.record_version_participant_id
        else None
    )

    observation = RecordVersionObservation(
        record_id=record.id,
        record_version_id=record.active_version_id,
        record_version_participant_id=visitor_session.record_version_participant_id,
        visitor_session_id=visitor_session.id,
        author_email=visitor_session.email,
        author_name=getattr(participant, "display_name", None),
        body=str(body or "").strip(),
        status="new",
        resolution_type="none",
    )
    db.add(observation)
    db.commit()
    db.refresh(observation)

    return MinuteViewObservationCreateResponse(
        message="La observación fue registrada sobre la versión actual de la minuta.",
        observation=MinuteViewObservationItem(
            id=int(observation.id),
            record_version_id=str(observation.record_version_id),
            author_email=observation.author_email,
            author_name=observation.author_name,
            body=observation.body,
            status=observation.status,
            resolution_type=observation.resolution_type,
            editor_comment=observation.editor_comment,
            resolved_by=str(observation.resolved_by) if observation.resolved_by else None,
            resolution_note=observation.resolution_note,
            resolved_at=observation.resolved_at.isoformat() if observation.resolved_at else None,
            applied_in_version_id=str(observation.applied_in_version_id) if observation.applied_in_version_id else None,
            created_at=observation.created_at.isoformat() if observation.created_at else None,
            updated_at=observation.updated_at.isoformat() if observation.updated_at else None,
            is_current_version=True,
        ),
    )


def _serialize_editor_observation_item(obs: RecordVersionObservation) -> MinuteObservationItem:
    version_num = None
    version_label = None
    if getattr(obs, "record_version", None):
        version_num = int(getattr(obs.record_version, "version_num", 0) or 0) or None
        version_label = f"v{version_num}" if version_num else None

    return MinuteObservationItem(
        id=int(obs.id),
        record_id=str(obs.record_id),
        record_version_id=str(obs.record_version_id),
        record_version_participant_id=int(obs.record_version_participant_id) if obs.record_version_participant_id else None,
        author_email=obs.author_email,
        author_name=obs.author_name,
        body=obs.body,
        status=obs.status,
        resolution_type=getattr(obs, "resolution_type", "none"),
        editor_comment=getattr(obs, "editor_comment", None),
        resolved_by=str(obs.resolved_by) if getattr(obs, "resolved_by", None) else None,
        resolved_at=obs.resolved_at.isoformat() if obs.resolved_at else None,
        applied_in_version_id=str(obs.applied_in_version_id) if getattr(obs, "applied_in_version_id", None) else None,
        created_at=obs.created_at.isoformat() if obs.created_at else None,
        updated_at=obs.updated_at.isoformat() if obs.updated_at else None,
        version_num=version_num,
        version_label=version_label,
    )


def list_editor_minute_observations(db: Session, *, record_id: str) -> MinuteObservationListResponse:
    _resolve_record_or_404(db, record_id)
    observations = (
        db.query(RecordVersionObservation)
        .join(RecordVersion, RecordVersionObservation.record_version_id == RecordVersion.id)
        .filter(RecordVersionObservation.record_id == record_id)
        .order_by(RecordVersion.version_num.desc(), RecordVersionObservation.created_at.desc(), RecordVersionObservation.id.desc())
        .all()
    )
    return MinuteObservationListResponse(
        record_id=record_id,
        items=[_serialize_editor_observation_item(item) for item in observations],
    )


def resolve_editor_minute_observation(
    db: Session,
    *,
    observation_id: int,
    status: str,
    resolution_type: str,
    editor_comment: str,
    actor_user_id: str,
) -> MinuteObservationResolveResponse:
    observation = (
        db.query(RecordVersionObservation)
        .filter(RecordVersionObservation.id == observation_id)
        .first()
    )
    if not observation:
        raise HTTPException(status_code=404, detail="Observación no encontrada")
    if str(observation.status or "").strip().lower() != "new":
        raise HTTPException(status_code=409, detail="La observación ya fue resuelta y no puede modificarse nuevamente")

    normalized_status = str(status or "").strip().lower()
    normalized_resolution_type = str(resolution_type or "").strip().lower()
    clean_comment = str(editor_comment or "").strip()

    if not clean_comment:
        raise HTTPException(status_code=422, detail="El comentario del editor es obligatorio")

    observation.status = normalized_status
    observation.resolution_type = normalized_resolution_type
    observation.editor_comment = clean_comment
    observation.resolved_by = actor_user_id
    observation.resolved_at = _utcnow()
    observation.applied_in_version_id = observation.record_version_id if normalized_status == "inserted" else None

    db.add(observation)
    db.commit()
    db.refresh(observation)

    return MinuteObservationResolveResponse(
        message="La observación fue actualizada correctamente.",
        item=_serialize_editor_observation_item(observation),
    )

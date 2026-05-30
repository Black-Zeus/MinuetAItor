from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from redis.exceptions import RedisError
from sqlalchemy.orm import Session
from starlette.requests import Request

from core.datetime_utils import normalize_datetime_strings_to_utc_z, utc_isoformat_z, utc_now, utc_now_db
from core.exceptions import UnauthorizedException
from core.rate_limit import enforce_rate_limit, rate_limit_key
from core.security import create_access_token, decode_access_token
from db.minio_client import get_minio_client
from db.redis import get_redis
from db.session import SessionLocal
from models.record_version_observation import RecordVersionObservation
from models.record_version_participant import RecordVersionParticipant
from models.record_versions import RecordVersion
from models.record_statuses import RecordStatus
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
from schemas.auth import UserSession
from services.access_control_service import ensure_record_read_access, ensure_record_write_access
from schemas.minute_observations import (
    MinuteObservationItem,
    MinuteObservationListResponse,
    MinuteObservationResolveResponse,
)
from services.notification_center_service import create_in_app_notification
from services.email_queue import queue_templated_email
from services.email_branding_service import build_email_branding_bundle
from services.minutes_service import get_minute_detail, get_minute_versions
from services.notification_service import enqueue_minute_guest_observation_email
from services.sse_instrumentation import new_sse_connection_id, sse_duration_ms, sse_log
from utils.device import get_device_string
from utils.network import get_client_ip

VISITOR_SESSION_PREFIX = "visitor-session"
VISITOR_OTP_TTL_MINUTES = 30
VISITOR_SESSION_TTL_HOURS = 8
VISITOR_OBSERVATION_LIMIT_PER_HOUR = 12
VISITOR_EVENTS_CHANNEL_PREFIX = "events:minute:public"
EDITOR_OBSERVATION_EVENTS_CHANNEL_PREFIX = "events:minute:editor:observations"
VISITOR_SSE_KEEPALIVE_SEC = 15
VISITOR_SSE_MAX_CONNECTION_SEC = 55
EDITOR_OBSERVATION_SSE_KEEPALIVE_SEC = 15
EDITOR_OBSERVATION_SSE_MAX_CONNECTION_SEC = 360

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return utc_now()


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _visitor_session_key(record_id: str, jti: str) -> str:
    return f"{VISITOR_SESSION_PREFIX}:{record_id}:{jti}"


def _visitor_events_channel(record_id: str) -> str:
    return f"{VISITOR_EVENTS_CHANNEL_PREFIX}:{record_id}"


def _editor_observation_events_channel(record_id: str) -> str:
    return f"{EDITOR_OBSERVATION_EVENTS_CHANNEL_PREFIX}:{record_id}"


def minute_view_sse_headers() -> dict:
    return {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
    }


def _minute_view_sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(normalize_datetime_strings_to_utc_z(data))}\n\n"


async def publish_minute_view_observation_event(
    *,
    record_id: str,
    observation_id: int,
    record_version_id: str | None,
    status: str,
    resolution_type: str,
) -> None:
    redis = get_redis()
    payload = {
        "event": "observation_resolved",
        "recordId": str(record_id),
        "observationId": int(observation_id),
        "recordVersionId": str(record_version_id) if record_version_id else None,
        "status": str(status or "").strip(),
        "resolutionType": str(resolution_type or "").strip(),
        "ts": utc_isoformat_z(utc_now()),
    }
    await redis.publish(_visitor_events_channel(record_id), json.dumps(normalize_datetime_strings_to_utc_z(payload)))


async def publish_editor_minute_observation_event(
    *,
    event: str,
    record_id: str,
    observation_id: int,
    record_version_id: str | None,
    status: str,
    author_email: str | None = None,
    author_name: str | None = None,
    resolution_type: str | None = None,
) -> None:
    redis = get_redis()
    payload = {
        "event": str(event or "observation_updated").strip(),
        "recordId": str(record_id),
        "observationId": int(observation_id),
        "recordVersionId": str(record_version_id) if record_version_id else None,
        "status": str(status or "").strip(),
        "resolutionType": str(resolution_type or "").strip(),
        "authorEmail": author_email,
        "authorName": author_name,
        "ts": utc_isoformat_z(utc_now()),
    }
    await redis.publish(_editor_observation_events_channel(record_id), json.dumps(normalize_datetime_strings_to_utc_z(payload)))


def _normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def _clean_user_ids(*values: str | None) -> list[str]:
    seen: set[str] = set()
    items: list[str] = []
    for value in values:
        user_id = str(value or "").strip()
        if not user_id or user_id in seen:
            continue
        seen.add(user_id)
        items.append(user_id)
    return items


def _minute_email_subject(record: Record, message: str) -> str:
    clean_message = str(message or "").strip() or "Minuta"
    project_name = str(getattr(getattr(record, "project", None), "name", "") or "").strip()
    minute_title = str(getattr(record, "title", "") or "").strip() or "Minuta sin título"
    context_label = f"{project_name} / {minute_title}" if project_name else minute_title
    return f"{clean_message} {context_label}"


def _hash_otp(record_id: str, email: str, otp_code: str) -> str:
    raw = f"{record_id}:{_normalize_email(email)}:{otp_code}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _generic_otp_request_response(record_id: str, email: str) -> MinuteViewAccessRequestResponse:
    expires_at = _utcnow() + timedelta(minutes=VISITOR_OTP_TTL_MINUTES)
    return MinuteViewAccessRequestResponse(
        request_id=str(uuid.uuid4()),
        record_id=str(record_id or "").strip(),
        email=_normalize_email(email),
        expires_at=expires_at.isoformat(),
        message="Si el correo tiene acceso a la minuta, se enviará un código de un solo uso.",
    )


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
    normalized_email = _normalize_email(email)
    ip_v4, ip_v6 = get_client_ip(request)
    requester_ip = ip_v4 or ip_v6 or "unknown"
    await enforce_rate_limit(
        rate_limit_key("minute-view-otp-request", record_id, normalized_email, requester_ip),
        limit=5,
        window_seconds=60 * 60,
        message="Demasiadas solicitudes de acceso para esta minuta. Intenta nuevamente más tarde.",
    )

    try:
        record = _resolve_record_or_404(db, record_id)
        participant = _resolve_active_participant(db, record, email)
    except HTTPException as exc:
        if exc.status_code in {403, 404, 409}:
            return _generic_otp_request_response(record_id, normalized_email)
        raise

    otp_code = _generate_otp()
    expires_at = _utcnow() + timedelta(minutes=VISITOR_OTP_TTL_MINUTES)

    access_request = VisitorAccessRequest(
        id=str(uuid.uuid4()),
        record_id=record.id,
        record_version_id=record.active_version_id,
        record_version_participant_id=participant.id,
        email=normalized_email,
        otp_code_hash=_hash_otp(record.id, normalized_email, otp_code),
        otp_expires_at=expires_at.replace(tzinfo=None),
        requester_ip=requester_ip,
        requester_user_agent=request.headers.get("User-Agent"),
        delivery_status="queued",
    )
    db.add(access_request)
    db.commit()

    branding = build_email_branding_bundle(db, client=record.client, include_organization_logo=True, include_client_logo=False)
    await queue_templated_email(
        to=[normalized_email],
        template_id="minute_view_otp",
        subject=_minute_email_subject(record, "Código de acceso"),
        template_context={
            **branding.context,
            "USER_DISPLAY_NAME": participant.display_name or normalized_email,
            "USER_EMAIL": normalized_email,
            "MINUTE_TITLE": record.title,
            "MINUTE_ID": record.id,
            "OTP_CODE": otp_code,
            "OTP_TTL_MINUTES": VISITOR_OTP_TTL_MINUTES,
        },
        inline_assets=branding.inline_assets,
    )

    access_request.delivery_status = "sent"
    db.add(access_request)
    db.commit()

    return MinuteViewAccessRequestResponse(
        request_id=access_request.id,
        record_id=record.id,
        email=normalized_email,
        expires_at=expires_at.isoformat(),
        message="Si el correo tiene acceso a la minuta, se enviará un código de un solo uso.",
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
    ip_v4, ip_v6 = get_client_ip(request)
    requester_ip = ip_v4 or ip_v6 or "unknown"
    await enforce_rate_limit(
        rate_limit_key("minute-view-otp-verify", record_id, normalized_email, requester_ip),
        limit=10,
        window_seconds=30 * 60,
        message="Demasiados intentos de validación. Intenta nuevamente más tarde.",
    )
    otp_hash = _hash_otp(record_id, normalized_email, str(otp_code or "").strip())
    now = _utcnow()
    now_db = now.replace(tzinfo=None)

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
        raise HTTPException(status_code=401, detail="El código es inválido o expiró")

    access_request.attempt_count = int(access_request.attempt_count or 0) + 1
    access_request.last_attempt_at = now_db

    expires_at_utc = _as_utc(access_request.otp_expires_at)
    if (expires_at_utc and expires_at_utc < now) or access_request.otp_code_hash != otp_hash:
        db.add(access_request)
        db.commit()
        raise HTTPException(status_code=401, detail="El código es inválido o expiró")

    access_request.consumed_at = now_db
    db.add(access_request)

    participant = _resolve_active_participant(db, record, normalized_email)
    session_id = str(uuid.uuid4())
    jti = str(uuid.uuid4())
    expires_at = now + timedelta(hours=VISITOR_SESSION_TTL_HOURS)
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
        expires_at=expires_at.replace(tzinfo=None),
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
    try:
        exists = await asyncio.wait_for(redis.exists(_visitor_session_key(record_id, jti)), timeout=2.0)
    except (asyncio.TimeoutError, RedisError) as exc:
        logger.warning(
            "[minute-view] Redis no respondió al validar sesión visitante | record=%s session=%s err=%s",
            record_id,
            session_id,
            exc,
        )
        raise HTTPException(
            status_code=503,
            detail="No fue posible validar la sesión visitante. Intenta nuevamente en unos segundos.",
        ) from exc
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

    record = _resolve_record_or_404(db, record_id)
    participant = (
        db.query(RecordVersionParticipant)
        .filter(
            RecordVersionParticipant.id == session.record_version_participant_id,
            RecordVersionParticipant.record_version_id == record.active_version_id,
            RecordVersionParticipant.email.ilike(session.email),
        )
        .first()
    )
    if not participant:
        raise HTTPException(status_code=401, detail="La sesión visitante ya no está disponible")
    return session


async def logout_current_visitor_session(token: str, record_id: str, db: Session) -> None:
    session = await get_current_visitor_session(token, record_id, db)
    session.revoked_at = utc_now_db()
    db.add(session)
    db.commit()

    payload = decode_access_token(token)
    redis = get_redis()
    await redis.delete(_visitor_session_key(record_id, str(payload.get("jti") or "")))


async def stream_minute_view_events(
    *,
    token: str,
    record_id: str,
    request: Request,
):
    connection_id = new_sse_connection_id()
    endpoint = "minutes_public_events"
    started_at = time.monotonic()
    event_count = 0
    close_reason = "unknown"
    session_id = None
    channel = None
    sse_log(
        logger,
        "sse.open",
        connection_id=connection_id,
        endpoint=endpoint,
        channel=channel,
        record_id=record_id,
        transaction_id=None,
        user_id=None,
        visitor_session_id=session_id,
        duration_ms=None,
        close_reason=None,
        event_count=event_count,
    )
    db = SessionLocal()
    try:
        try:
            session = await get_current_visitor_session(token, record_id, db)
        except (HTTPException, UnauthorizedException) as exc:
            message = getattr(exc, "detail", None) or getattr(exc, "message", None)
            status_code = getattr(exc, "status_code", 401)
            close_reason = "visitor_session_invalid"
            event_count += 1
            sse_log(
                logger,
                "sse.terminal",
                connection_id=connection_id,
                endpoint=endpoint,
                channel=channel,
                record_id=record_id,
                transaction_id=None,
                user_id=None,
                visitor_session_id=session_id,
                duration_ms=sse_duration_ms(started_at),
                close_reason=close_reason,
                event_count=event_count,
                terminal_event="session_expired",
            )
            yield _minute_view_sse_event(
                "session_expired",
                {
                    "message": str(message or "La sesión visitante ya no está disponible."),
                    "status": status_code,
                },
            )
            sse_log(
                logger,
                "sse.close",
                connection_id=connection_id,
                endpoint=endpoint,
                channel=channel,
                record_id=record_id,
                transaction_id=None,
                user_id=None,
                visitor_session_id=session_id,
                duration_ms=sse_duration_ms(started_at),
                close_reason=close_reason,
                event_count=event_count,
            )
            return
        session_id = str(session.id)
    finally:
        db.close()

    redis = get_redis()
    pubsub = redis.pubsub()
    channel = _visitor_events_channel(record_id)
    try:
        await asyncio.wait_for(pubsub.subscribe(channel), timeout=2.0)
    except (asyncio.TimeoutError, RedisError) as exc:
        close_reason = "redis_subscribe_error"
        sse_log(
            logger,
            "sse.exception",
            level="warning",
            connection_id=connection_id,
            endpoint=endpoint,
            channel=channel,
            record_id=record_id,
            transaction_id=None,
            user_id=None,
            visitor_session_id=session_id,
            duration_ms=sse_duration_ms(started_at),
            close_reason=close_reason,
            event_count=event_count,
            error_type=type(exc).__name__,
        )
        logger.warning(
            "[minute-view-sse] No fue posible suscribir a Redis | session=%s record=%s channel=%s err=%s",
            session_id,
            record_id,
            channel,
            exc,
        )
        event_count += 1
        yield _minute_view_sse_event(
            "error",
            {"message": "No fue posible abrir el canal de actualizaciones. Reintenta en unos segundos."},
        )
        try:
            await pubsub.close()
        except Exception:
            pass
        sse_log(
            logger,
            "sse.close",
            connection_id=connection_id,
            endpoint=endpoint,
            channel=channel,
            record_id=record_id,
            transaction_id=None,
            user_id=None,
            visitor_session_id=session_id,
            duration_ms=sse_duration_ms(started_at),
            close_reason=close_reason,
            event_count=event_count,
        )
        return
    sse_log(
        logger,
        "sse.redis.subscribe",
        connection_id=connection_id,
        endpoint=endpoint,
        channel=channel,
        record_id=record_id,
        transaction_id=None,
        user_id=None,
        visitor_session_id=session_id,
        duration_ms=sse_duration_ms(started_at),
        close_reason=None,
        event_count=event_count,
    )
    logger.info("[minute-view-sse] Suscrito | session=%s record=%s channel=%s", session_id, record_id, channel)

    try:
        last_ping_at = started_at

        while True:
            now = time.monotonic()
            if await request.is_disconnected():
                close_reason = "client_disconnect"
                logger.info("[minute-view-sse] Cliente desconectado | session=%s record=%s channel=%s", session_id, record_id, channel)
                break

            if now - started_at >= VISITOR_SSE_MAX_CONNECTION_SEC:
                close_reason = "server_recycle"
                event_count += 1
                sse_log(
                    logger,
                    "sse.recycle",
                    connection_id=connection_id,
                    endpoint=endpoint,
                    channel=channel,
                    record_id=record_id,
                    transaction_id=None,
                    user_id=None,
                    visitor_session_id=session_id,
                    duration_ms=sse_duration_ms(started_at),
                    close_reason=close_reason,
                    event_count=event_count,
                )
                yield _minute_view_sse_event("keepalive", {"reason": "connection_recycle"})
                break

            if now - last_ping_at >= VISITOR_SSE_KEEPALIVE_SEC:
                event_count += 1
                yield _minute_view_sse_event("keepalive", {})
                last_ping_at = now

            try:
                msg = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=2.0,
                )
            except asyncio.TimeoutError:
                continue
            except RedisError as exc:
                close_reason = "redis_read_error"
                sse_log(
                    logger,
                    "sse.exception",
                    level="warning",
                    connection_id=connection_id,
                    endpoint=endpoint,
                    channel=channel,
                    record_id=record_id,
                    transaction_id=None,
                    user_id=None,
                    visitor_session_id=session_id,
                    duration_ms=sse_duration_ms(started_at),
                    close_reason=close_reason,
                    event_count=event_count,
                    error_type=type(exc).__name__,
                )
                logger.warning("[minute-view-sse] Redis interrumpió el stream | session=%s record=%s err=%s", session_id, record_id, exc)
                event_count += 1
                yield _minute_view_sse_event(
                    "error",
                    {"message": "Se perdió el canal de actualizaciones. Reintenta en unos segundos."},
                )
                break

            if not msg or msg["type"] != "message":
                await asyncio.sleep(0.1)
                continue

            try:
                event_data = json.loads(msg["data"])
            except (json.JSONDecodeError, TypeError):
                await asyncio.sleep(0.1)
                continue

            if str(event_data.get("recordId") or "") != str(record_id):
                await asyncio.sleep(0.1)
                continue

            event_count += 1
            yield _minute_view_sse_event(event_data.get("event", "minute_view_update"), event_data)
            await asyncio.sleep(0.1)
    except Exception as exc:
        close_reason = "exception"
        sse_log(
            logger,
            "sse.exception",
            level="exception",
            connection_id=connection_id,
            endpoint=endpoint,
            channel=channel,
            record_id=record_id,
            transaction_id=None,
            user_id=None,
            visitor_session_id=session_id,
            duration_ms=sse_duration_ms(started_at),
            close_reason=close_reason,
            event_count=event_count,
            error_type=type(exc).__name__,
        )
        raise
    finally:
        try:
            await pubsub.unsubscribe(channel)
            sse_log(
                logger,
                "sse.redis.unsubscribe",
                connection_id=connection_id,
                endpoint=endpoint,
                channel=channel,
                record_id=record_id,
                transaction_id=None,
                user_id=None,
                visitor_session_id=session_id,
                duration_ms=sse_duration_ms(started_at),
                close_reason=close_reason,
                event_count=event_count,
            )
            await pubsub.close()
        except Exception:
            pass
        sse_log(
            logger,
            "sse.close",
            connection_id=connection_id,
            endpoint=endpoint,
            channel=channel,
            record_id=record_id,
            transaction_id=None,
            user_id=None,
            visitor_session_id=session_id,
            duration_ms=sse_duration_ms(started_at),
            close_reason=close_reason,
            event_count=event_count,
        )
        logger.info("[minute-view-sse] Cleanup ejecutado y stream cerrado | session=%s record=%s channel=%s", session_id, record_id, channel)


async def stream_editor_minute_observation_events(
    *,
    record_id: str,
    session: UserSession,
    request: Request,
):
    connection_id = new_sse_connection_id()
    endpoint = "minute_editor_observations_events"
    started_at = time.monotonic()
    event_count = 0
    close_reason = "unknown"
    redis = get_redis()
    pubsub = redis.pubsub()
    channel = _editor_observation_events_channel(record_id)
    sse_log(
        logger,
        "sse.open",
        connection_id=connection_id,
        endpoint=endpoint,
        channel=channel,
        record_id=record_id,
        transaction_id=None,
        user_id=session.user_id,
        visitor_session_id=None,
        duration_ms=None,
        close_reason=None,
        event_count=event_count,
    )
    try:
        await asyncio.wait_for(pubsub.subscribe(channel), timeout=2.0)
    except (asyncio.TimeoutError, RedisError) as exc:
        close_reason = "redis_subscribe_error"
        sse_log(
            logger,
            "sse.exception",
            level="warning",
            connection_id=connection_id,
            endpoint=endpoint,
            channel=channel,
            record_id=record_id,
            transaction_id=None,
            user_id=session.user_id,
            visitor_session_id=None,
            duration_ms=sse_duration_ms(started_at),
            close_reason=close_reason,
            event_count=event_count,
            error_type=type(exc).__name__,
        )
        logger.warning(
            "[minute-editor-observations-sse] No fue posible suscribir a Redis | user=%s record=%s channel=%s err=%s",
            session.user_id,
            record_id,
            channel,
            exc,
        )
        event_count += 1
        yield _minute_view_sse_event(
            "error",
            {"message": "No fue posible abrir el canal de observaciones. Reintenta en unos segundos."},
        )
        try:
            await pubsub.close()
        except Exception:
            pass
        sse_log(
            logger,
            "sse.close",
            connection_id=connection_id,
            endpoint=endpoint,
            channel=channel,
            record_id=record_id,
            transaction_id=None,
            user_id=session.user_id,
            visitor_session_id=None,
            duration_ms=sse_duration_ms(started_at),
            close_reason=close_reason,
            event_count=event_count,
        )
        return
    sse_log(
        logger,
        "sse.redis.subscribe",
        connection_id=connection_id,
        endpoint=endpoint,
        channel=channel,
        record_id=record_id,
        transaction_id=None,
        user_id=session.user_id,
        visitor_session_id=None,
        duration_ms=sse_duration_ms(started_at),
        close_reason=None,
        event_count=event_count,
    )
    logger.info("[minute-editor-observations-sse] Suscrito | user=%s record=%s channel=%s", session.user_id, record_id, channel)

    try:
        last_ping_at = started_at

        while True:
            now = time.monotonic()
            if await request.is_disconnected():
                close_reason = "client_disconnect"
                logger.info("[minute-editor-observations-sse] Cliente desconectado | user=%s record=%s channel=%s", session.user_id, record_id, channel)
                break

            if now - started_at >= EDITOR_OBSERVATION_SSE_MAX_CONNECTION_SEC:
                close_reason = "server_recycle"
                event_count += 1
                sse_log(
                    logger,
                    "sse.recycle",
                    connection_id=connection_id,
                    endpoint=endpoint,
                    channel=channel,
                    record_id=record_id,
                    transaction_id=None,
                    user_id=session.user_id,
                    visitor_session_id=None,
                    duration_ms=sse_duration_ms(started_at),
                    close_reason=close_reason,
                    event_count=event_count,
                )
                yield _minute_view_sse_event("keepalive", {"reason": "connection_recycle"})
                break

            if now - last_ping_at >= EDITOR_OBSERVATION_SSE_KEEPALIVE_SEC:
                event_count += 1
                yield _minute_view_sse_event("keepalive", {})
                last_ping_at = now

            try:
                msg = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=2.0,
                )
            except asyncio.TimeoutError:
                continue
            except RedisError as exc:
                close_reason = "redis_read_error"
                sse_log(
                    logger,
                    "sse.exception",
                    level="warning",
                    connection_id=connection_id,
                    endpoint=endpoint,
                    channel=channel,
                    record_id=record_id,
                    transaction_id=None,
                    user_id=session.user_id,
                    visitor_session_id=None,
                    duration_ms=sse_duration_ms(started_at),
                    close_reason=close_reason,
                    event_count=event_count,
                    error_type=type(exc).__name__,
                )
                logger.warning("[minute-editor-observations-sse] Redis interrumpió el stream | user=%s record=%s err=%s", session.user_id, record_id, exc)
                event_count += 1
                yield _minute_view_sse_event(
                    "error",
                    {"message": "Se perdió el canal de observaciones. Reintenta en unos segundos."},
                )
                break

            if not msg or msg["type"] != "message":
                await asyncio.sleep(0.1)
                continue

            try:
                event_data = json.loads(msg["data"])
            except (json.JSONDecodeError, TypeError):
                await asyncio.sleep(0.1)
                continue

            if str(event_data.get("recordId") or "") != str(record_id):
                await asyncio.sleep(0.1)
                continue

            event_count += 1
            yield _minute_view_sse_event(event_data.get("event", "observation_updated"), event_data)
            await asyncio.sleep(0.1)
    except Exception as exc:
        close_reason = "exception"
        sse_log(
            logger,
            "sse.exception",
            level="exception",
            connection_id=connection_id,
            endpoint=endpoint,
            channel=channel,
            record_id=record_id,
            transaction_id=None,
            user_id=session.user_id,
            visitor_session_id=None,
            duration_ms=sse_duration_ms(started_at),
            close_reason=close_reason,
            event_count=event_count,
            error_type=type(exc).__name__,
        )
        raise
    finally:
        try:
            await pubsub.unsubscribe(channel)
            sse_log(
                logger,
                "sse.redis.unsubscribe",
                connection_id=connection_id,
                endpoint=endpoint,
                channel=channel,
                record_id=record_id,
                transaction_id=None,
                user_id=session.user_id,
                visitor_session_id=None,
                duration_ms=sse_duration_ms(started_at),
                close_reason=close_reason,
                event_count=event_count,
            )
            await pubsub.close()
        except Exception:
            pass
        sse_log(
            logger,
            "sse.close",
            connection_id=connection_id,
            endpoint=endpoint,
            channel=channel,
            record_id=record_id,
            transaction_id=None,
            user_id=session.user_id,
            visitor_session_id=None,
            duration_ms=sse_duration_ms(started_at),
            close_reason=close_reason,
            event_count=event_count,
        )
        logger.info("[minute-editor-observations-sse] Cleanup ejecutado y stream cerrado | user=%s record=%s channel=%s", session.user_id, record_id, channel)


def _build_observation_groups(
    db: Session,
    record_id: str,
    active_version_id: str | None,
    visitor_session: VisitorSession,
) -> list[MinuteViewObservationGroup]:
    versions_response = get_minute_versions(db, record_id)
    observations = (
        db.query(RecordVersionObservation)
        .filter(RecordVersionObservation.record_id == record_id)
        .filter(RecordVersionObservation.author_email == _normalize_email(visitor_session.email))
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


def _build_shared_observation_groups(
    db: Session,
    record_id: str,
    active_version_id: str | None,
    visitor_session: VisitorSession,
) -> list[MinuteViewObservationGroup]:
    versions_response = get_minute_versions(db, record_id)
    observations = (
        db.query(RecordVersionObservation)
        .filter(RecordVersionObservation.record_id == record_id)
        .filter(RecordVersionObservation.status.in_(("approved", "inserted")))
        .filter(RecordVersionObservation.author_email != _normalize_email(visitor_session.email))
        .order_by(RecordVersionObservation.created_at.desc(), RecordVersionObservation.id.desc())
        .all()
    )

    grouped: dict[str, list[MinuteViewObservationItem]] = {}
    for obs in observations:
        grouped.setdefault(str(obs.record_version_id), []).append(
            _serialize_visitor_observation_item(obs, active_version_id=active_version_id)
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


def _serialize_visitor_observation_item(
    obs: RecordVersionObservation,
    *,
    active_version_id: str | None,
) -> MinuteViewObservationItem:
    return MinuteViewObservationItem(
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
        observation_groups=_build_observation_groups(db, record_id, record.active_version_id, visitor_session),
        shared_observation_groups=_build_shared_observation_groups(db, record_id, record.active_version_id, visitor_session),
        current_version_id=str(record.active_version_id) if record.active_version_id else None,
        current_version_num=int(record.latest_version_num) if record.latest_version_num else None,
    )


def get_minute_view_pdf_bytes(db: Session, *, record_id: str) -> tuple[bytes, str]:
    record = _resolve_record_or_404(db, record_id)
    if not record.active_version_id:
        raise HTTPException(status_code=404, detail="La minuta no tiene una versión activa con PDF")

    status_row = db.query(RecordStatus).filter(RecordStatus.id == record.status_id).first()
    status_code = str(getattr(status_row, "code", "") or "").strip().lower()
    if status_code == "completed":
        bucket = "minuetaitor-published"
        key = f"published/{record_id}/final.pdf"
        missing_message = "No existe un PDF publicado disponible para esta minuta"
    else:
        bucket = "minuetaitor-draft"
        key = f"drafts/{record_id}/draft_current.pdf"
        missing_message = "El PDF de revisión aún no está disponible para esta minuta"

    minio = get_minio_client()
    try:
        obj = minio.get_object(bucket, key)
        pdf_bytes = obj.read()
        obj.close()
        obj.release_conn()
    except Exception as exc:
        raise HTTPException(status_code=404, detail=missing_message) from exc

    if not pdf_bytes:
        raise HTTPException(status_code=404, detail=missing_message)
    return pdf_bytes, f"minute-{record_id}.pdf"


async def create_minute_view_observation(
    db: Session,
    *,
    record_id: str,
    body: str,
    visitor_session: VisitorSession,
) -> MinuteViewObservationCreateResponse:
    record = _resolve_record_or_404(db, record_id)
    if not record.active_version_id:
        raise HTTPException(status_code=409, detail="La minuta no tiene una versión activa para registrar observaciones")
    status_row = db.query(RecordStatus).filter(RecordStatus.id == record.status_id).first()
    status_code = str(getattr(status_row, "code", "") or "").strip().lower()
    if status_code != "preview":
        raise HTTPException(
            status_code=409,
            detail="La minuta ya no está en revisión. No es posible registrar nuevas observaciones.",
        )
    await enforce_rate_limit(
        rate_limit_key("minute-view-observation", record_id, visitor_session.email, visitor_session.id),
        limit=VISITOR_OBSERVATION_LIMIT_PER_HOUR,
        window_seconds=60 * 60,
        message="Demasiadas observaciones registradas para esta minuta. Intenta nuevamente más tarde.",
    )

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

    recipient_user_ids = _clean_user_ids(
        getattr(record, "prepared_by_user_id", None),
        getattr(record, "created_by", None),
        getattr(record, "updated_by", None),
    )
    if recipient_user_ids:
        author_label = str(observation.author_name or observation.author_email or "Un invitado").strip()
        try:
            await create_in_app_notification(
                db,
                notification_type="minute.observation.created",
                title="Nueva observación de invitado",
                message=f'{author_label} dejó una observación en la minuta "{record.title}".',
                level="info",
                tags=["minute", "observation", "guest", "minute.observation.created"],
                recipient_user_ids=recipient_user_ids,
                scope_type="record",
                scope_id=str(record.id),
                action_url=f"/minutes/process/{record.id}",
                metadata={
                    "recordId": str(record.id),
                    "recordVersionId": str(observation.record_version_id),
                    "observationId": int(observation.id),
                    "visitorSessionId": str(visitor_session.id),
                    "authorEmail": observation.author_email,
                    "authorName": observation.author_name,
                },
            )
        except Exception as notify_exc:
            logger.warning(
                "No se pudo crear notificación in-app para observación visitante | record=%s obs=%s err=%s",
                record_id,
                observation.id,
                notify_exc,
            )

    try:
        await publish_editor_minute_observation_event(
            event="observation_created",
            record_id=str(record.id),
            observation_id=int(observation.id),
            record_version_id=str(observation.record_version_id) if observation.record_version_id else None,
            status=observation.status,
            resolution_type=observation.resolution_type,
            author_email=observation.author_email,
            author_name=observation.author_name,
        )
    except Exception as event_exc:
        logger.warning(
            "No se pudo publicar evento SSE de nueva observación para editor | record=%s obs=%s err=%s",
            record.id,
            observation.id,
            event_exc,
        )

    try:
        await enqueue_minute_guest_observation_email(
            db,
            record.id,
            observation_id=int(observation.id),
            record_version_id=str(observation.record_version_id),
            author_name=observation.author_name,
            author_email=observation.author_email,
            observation_body=observation.body,
        )
    except Exception as email_exc:
        logger.warning(
            "No se pudo encolar correo de observación visitante | record=%s obs=%s err=%s",
            record.id,
            observation.id,
            email_exc,
        )

    return MinuteViewObservationCreateResponse(
        message="La observación fue registrada sobre la versión actual de la minuta.",
        observation=_serialize_visitor_observation_item(observation, active_version_id=str(record.active_version_id)),
    )


def _ensure_public_observation_mutable(
    db: Session,
    *,
    record_id: str,
    observation_id: int,
    visitor_session: VisitorSession,
) -> tuple[Record, RecordVersionObservation]:
    record = _resolve_record_or_404(db, record_id)
    status_row = db.query(RecordStatus).filter(RecordStatus.id == record.status_id).first()
    status_code = str(getattr(status_row, "code", "") or "").strip().lower()
    if status_code != "preview":
        raise HTTPException(
            status_code=409,
            detail="La minuta ya no está en revisión. No es posible modificar observaciones.",
        )

    observation = (
        db.query(RecordVersionObservation)
        .filter(RecordVersionObservation.id == observation_id)
        .filter(RecordVersionObservation.record_id == record_id)
        .filter(RecordVersionObservation.author_email == _normalize_email(visitor_session.email))
        .first()
    )
    if not observation:
        raise HTTPException(status_code=404, detail="Observación no encontrada")
    if str(observation.record_version_id) != str(record.active_version_id or ""):
        raise HTTPException(status_code=409, detail="Solo se puede modificar la observación de la versión activa.")
    if str(observation.status or "").strip().lower() != "new":
        raise HTTPException(status_code=409, detail="La observación ya fue procesada y no puede modificarse.")
    return record, observation


async def update_minute_view_observation(
    db: Session,
    *,
    record_id: str,
    observation_id: int,
    body: str,
    visitor_session: VisitorSession,
) -> MinuteViewObservationCreateResponse:
    record, observation = _ensure_public_observation_mutable(
        db,
        record_id=record_id,
        observation_id=observation_id,
        visitor_session=visitor_session,
    )
    observation.body = str(body or "").strip()
    db.add(observation)
    db.commit()
    db.refresh(observation)

    try:
        await publish_editor_minute_observation_event(
            event="observation_updated",
            record_id=str(record.id),
            observation_id=int(observation.id),
            record_version_id=str(observation.record_version_id) if observation.record_version_id else None,
            status=observation.status,
            resolution_type=observation.resolution_type,
            author_email=observation.author_email,
            author_name=observation.author_name,
        )
    except Exception as event_exc:
        logger.warning(
            "No se pudo publicar evento SSE de observación actualizada para editor | record=%s obs=%s err=%s",
            record.id,
            observation.id,
            event_exc,
        )

    return MinuteViewObservationCreateResponse(
        message="La observación fue actualizada.",
        observation=_serialize_visitor_observation_item(observation, active_version_id=str(record.active_version_id)),
    )


async def delete_minute_view_observation(
    db: Session,
    *,
    record_id: str,
    observation_id: int,
    visitor_session: VisitorSession,
) -> None:
    record, observation = _ensure_public_observation_mutable(
        db,
        record_id=record_id,
        observation_id=observation_id,
        visitor_session=visitor_session,
    )
    record_version_id = str(observation.record_version_id) if observation.record_version_id else None
    db.delete(observation)
    db.commit()

    try:
        await publish_editor_minute_observation_event(
            event="observation_deleted",
            record_id=str(record.id),
            observation_id=int(observation_id),
            record_version_id=record_version_id,
            status="deleted",
            resolution_type="none",
            author_email=visitor_session.email,
            author_name=None,
        )
    except Exception as event_exc:
        logger.warning(
            "No se pudo publicar evento SSE de observación eliminada para editor | record=%s obs=%s err=%s",
            record.id,
            observation_id,
            event_exc,
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


async def resolve_editor_minute_observation(
    db: Session,
    *,
    observation_id: int,
    status: str,
    resolution_type: str,
    editor_comment: str,
    actor_user_id: str,
    session: UserSession | None = None,
) -> MinuteObservationResolveResponse:
    observation = (
        db.query(RecordVersionObservation)
        .filter(RecordVersionObservation.id == observation_id)
        .first()
    )
    if not observation:
        raise HTTPException(status_code=404, detail="Observación no encontrada")
    if session is not None:
        ensure_record_write_access(db, session, str(observation.record_id), permissions=("records.update",))
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
    observation.resolved_at = utc_now_db()
    observation.applied_in_version_id = observation.record_version_id if normalized_status == "inserted" else None

    db.add(observation)
    db.commit()
    db.refresh(observation)

    record = _resolve_record_or_404(db, str(observation.record_id))
    recipient_user_ids = _clean_user_ids(
        getattr(record, "prepared_by_user_id", None),
        getattr(record, "created_by", None),
        getattr(record, "updated_by", None),
        actor_user_id,
    )
    if recipient_user_ids:
        author_label = str(observation.author_name or observation.author_email or "Un invitado").strip()
        notification_type = f"minute.observation.{normalized_status}"
        title_map = {
            "inserted": "Observación incorporada",
            "approved": "Observación aprobada",
            "rejected": "Observación rechazada",
        }
        message_map = {
            "inserted": f'Se incorporó una observación de {author_label} en la minuta "{record.title}".',
            "approved": f'Se aprobó una observación de {author_label} para actualización manual en la minuta "{record.title}".',
            "rejected": f'Se rechazó una observación de {author_label} en la minuta "{record.title}".',
        }
        try:
            await create_in_app_notification(
                db,
                notification_type=notification_type,
                title=title_map.get(normalized_status, "Observación actualizada"),
                message=message_map.get(normalized_status, f'Se actualizó una observación en la minuta "{record.title}".'),
                level="success" if normalized_status != "rejected" else "warning",
                tags=["minute", "observation", "guest", notification_type],
                recipient_user_ids=recipient_user_ids,
                scope_type="record",
                scope_id=str(record.id),
                action_url=f"/minutes/process/{record.id}",
                actor_user_id=actor_user_id,
                metadata={
                    "recordId": str(record.id),
                    "recordVersionId": str(observation.record_version_id),
                    "observationId": int(observation.id),
                    "status": normalized_status,
                    "resolutionType": normalized_resolution_type,
                    "authorEmail": observation.author_email,
                    "authorName": observation.author_name,
                },
            )
        except Exception as notify_exc:
            logger.warning(
                "No se pudo crear notificación in-app para resolución de observación | record=%s obs=%s err=%s",
                record.id,
                observation.id,
                notify_exc,
            )

    try:
        await publish_minute_view_observation_event(
            record_id=str(observation.record_id),
            observation_id=int(observation.id),
            record_version_id=str(observation.record_version_id) if observation.record_version_id else None,
            status=normalized_status,
            resolution_type=normalized_resolution_type,
        )
    except Exception as event_exc:
        logger.warning(
            "No se pudo publicar evento SSE de resolución visitante | record=%s obs=%s err=%s",
            observation.record_id,
            observation.id,
            event_exc,
        )

    try:
        await publish_editor_minute_observation_event(
            event="observation_resolved",
            record_id=str(observation.record_id),
            observation_id=int(observation.id),
            record_version_id=str(observation.record_version_id) if observation.record_version_id else None,
            status=normalized_status,
            resolution_type=normalized_resolution_type,
            author_email=observation.author_email,
            author_name=observation.author_name,
        )
    except Exception as event_exc:
        logger.warning(
            "No se pudo publicar evento SSE de resolución para editor | record=%s obs=%s err=%s",
            observation.record_id,
            observation.id,
            event_exc,
        )

    return MinuteObservationResolveResponse(
        message="La observación fue actualizada correctamente.",
        item=_serialize_editor_observation_item(observation),
    )

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import Request

from core.config import settings
from core.datetime_utils import normalize_datetime_strings_to_utc_z, utc_isoformat_z, utc_now
from db.redis import get_redis
from schemas.auth import UserSession
from services.sse_instrumentation import new_sse_connection_id, sse_duration_ms, sse_log

logger = logging.getLogger(__name__)

MAINTENANCE_EVENTS_CHANNEL = "events:system:maintenance"
MAINTENANCE_SSE_KEEPALIVE_SEC = 15
MAINTENANCE_SSE_MAX_CONNECTION_SEC = 55


def get_maintenance_events_channel() -> str:
    return MAINTENANCE_EVENTS_CHANNEL


def maintenance_sse_headers() -> dict:
    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }
    if settings.env_name == "dev":
        headers["Access-Control-Allow-Origin"] = "*"
    elif len(settings.cors_allowed_origins) == 1:
        headers["Access-Control-Allow-Origin"] = settings.cors_allowed_origins[0]
    return headers


def _maintenance_sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(normalize_datetime_strings_to_utc_z(data))}\n\n"


async def publish_maintenance_event(
    *,
    status: str,
    scope: str,
    action: str,
    message: str,
    trigger: str,
    job_id: str | None = None,
    scheduled_slot: str | None = None,
    actor_user_id: str | None = None,
    affected_count: int | None = None,
    metadata: dict | None = None,
) -> None:
    redis = get_redis()
    payload = {
        "event": "maintenance_update",
        "status": str(status or "").strip() or "info",
        "scope": str(scope or "").strip(),
        "action": str(action or "").strip(),
        "message": str(message or "").strip(),
        "trigger": str(trigger or "").strip() or "unknown",
        "job_id": job_id,
        "scheduled_slot": scheduled_slot,
        "actor_user_id": actor_user_id,
        "affected_count": affected_count,
        "ts": utc_isoformat_z(utc_now()),
        "metadata": metadata or {},
    }
    await redis.publish(get_maintenance_events_channel(), json.dumps(normalize_datetime_strings_to_utc_z(payload)))


async def stream_system_maintenance_events(session: UserSession, request: Request) -> AsyncGenerator[str, None]:
    connection_id = new_sse_connection_id()
    endpoint = "system_maintenance_events"
    started_at = time.monotonic()
    event_count = 0
    close_reason = "unknown"
    redis = get_redis()
    pubsub = redis.pubsub()
    channel = get_maintenance_events_channel()
    sse_log(
        logger,
        "sse.open",
        connection_id=connection_id,
        endpoint=endpoint,
        channel=channel,
        record_id=None,
        transaction_id=None,
        user_id=session.user_id,
        visitor_session_id=None,
        duration_ms=None,
        close_reason=None,
        event_count=event_count,
    )
    try:
        await pubsub.subscribe(channel)
    except Exception as exc:
        close_reason = "exception"
        sse_log(
            logger,
            "sse.exception",
            level="exception",
            connection_id=connection_id,
            endpoint=endpoint,
            channel=channel,
            record_id=None,
            transaction_id=None,
            user_id=session.user_id,
            visitor_session_id=None,
            duration_ms=sse_duration_ms(started_at),
            close_reason=close_reason,
            event_count=event_count,
            error_type=type(exc).__name__,
        )
        sse_log(
            logger,
            "sse.close",
            connection_id=connection_id,
            endpoint=endpoint,
            channel=channel,
            record_id=None,
            transaction_id=None,
            user_id=session.user_id,
            visitor_session_id=None,
            duration_ms=sse_duration_ms(started_at),
            close_reason=close_reason,
            event_count=event_count,
        )
        raise
    sse_log(
        logger,
        "sse.redis.subscribe",
        connection_id=connection_id,
        endpoint=endpoint,
        channel=channel,
        record_id=None,
        transaction_id=None,
        user_id=session.user_id,
        visitor_session_id=None,
        duration_ms=sse_duration_ms(started_at),
        close_reason=None,
        event_count=event_count,
    )
    logger.info("[maintenance-sse] Suscrito | user=%s channel=%s", session.user_id, channel)

    try:
        last_ping_at = started_at

        while True:
            now = time.monotonic()
            if await request.is_disconnected():
                close_reason = "client_disconnect"
                logger.info("[maintenance-sse] Cliente desconectado | user=%s channel=%s", session.user_id, channel)
                break

            if now - started_at >= MAINTENANCE_SSE_MAX_CONNECTION_SEC:
                close_reason = "server_recycle"
                event_count += 1
                sse_log(
                    logger,
                    "sse.recycle",
                    connection_id=connection_id,
                    endpoint=endpoint,
                    channel=channel,
                    record_id=None,
                    transaction_id=None,
                    user_id=session.user_id,
                    visitor_session_id=None,
                    duration_ms=sse_duration_ms(started_at),
                    close_reason=close_reason,
                    event_count=event_count,
                )
                yield _maintenance_sse_event("keepalive", {"reason": "connection_recycle"})
                break

            if now - last_ping_at >= MAINTENANCE_SSE_KEEPALIVE_SEC:
                event_count += 1
                yield _maintenance_sse_event("keepalive", {})
                last_ping_at = now

            try:
                msg = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=2.0,
                )
            except asyncio.TimeoutError:
                continue

            if not msg or msg["type"] != "message":
                await asyncio.sleep(0.1)
                continue

            try:
                event_data = json.loads(msg["data"])
            except (json.JSONDecodeError, TypeError):
                await asyncio.sleep(0.1)
                continue

            event_count += 1
            yield _maintenance_sse_event(event_data.get("event", "maintenance_update"), event_data)
            logger.info(
                "[maintenance-sse] Evento enviado | event=%s status=%s scope=%s user=%s",
                event_data.get("event", "maintenance_update"),
                event_data.get("status"),
                event_data.get("scope"),
                session.user_id,
            )
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
            record_id=None,
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
                record_id=None,
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
            record_id=None,
            transaction_id=None,
            user_id=session.user_id,
            visitor_session_id=None,
            duration_ms=sse_duration_ms(started_at),
            close_reason=close_reason,
            event_count=event_count,
        )
        logger.info("[maintenance-sse] Cleanup ejecutado y stream cerrado | user=%s channel=%s", session.user_id, channel)

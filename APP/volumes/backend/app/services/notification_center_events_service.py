from __future__ import annotations

import asyncio
import json
import logging
import time
from redis.exceptions import RedisError
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import Request

from core.datetime_utils import normalize_datetime_strings_to_utc_z, utc_isoformat_z, utc_now
from db.redis import get_redis
from schemas.auth import UserSession
from services.sse_instrumentation import new_sse_connection_id, sse_duration_ms, sse_log

logger = logging.getLogger(__name__)

NOTIFICATION_EVENTS_PREFIX = "events:notifications"
NOTIFICATION_SSE_KEEPALIVE_SEC = 15
NOTIFICATION_SSE_MAX_CONNECTION_SEC = 55


def get_notification_events_channel(user_id: str) -> str:
    return f"{NOTIFICATION_EVENTS_PREFIX}:{user_id}"


def notification_sse_headers() -> dict:
    return {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
    }


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(normalize_datetime_strings_to_utc_z(data))}\n\n"


async def publish_notification_event(user_id: str, event: str, payload: dict) -> None:
    redis = get_redis()
    body = {
        "event": event,
        "user_id": user_id,
        "ts": utc_isoformat_z(utc_now()),
        **(payload or {}),
    }
    await redis.publish(get_notification_events_channel(user_id), json.dumps(normalize_datetime_strings_to_utc_z(body)))


async def stream_user_notifications(session: UserSession, request: Request) -> AsyncGenerator[str, None]:
    connection_id = new_sse_connection_id()
    endpoint = "notifications_events"
    started_at = time.monotonic()
    event_count = 0
    close_reason = "unknown"
    redis = await get_redis()
    pubsub = redis.pubsub()
    channel = get_notification_events_channel(session.user_id)
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
        close_reason = "redis_subscribe_error" if isinstance(exc, RedisError) else "exception"
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
    logger.info("[notifications-sse] Suscrito | user=%s channel=%s", session.user_id, channel)

    try:
        last_ping_at = started_at

        while True:
            now = time.monotonic()
            if await request.is_disconnected():
                close_reason = "client_disconnect"
                logger.info("[notifications-sse] Cliente desconectado | user=%s channel=%s", session.user_id, channel)
                break

            if now - started_at >= NOTIFICATION_SSE_MAX_CONNECTION_SEC:
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
                yield _sse_event("keepalive", {"reason": "connection_recycle"})
                break

            if now - last_ping_at >= NOTIFICATION_SSE_KEEPALIVE_SEC:
                event_count += 1
                yield _sse_event("keepalive", {})
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

            event_name = event_data.get("event", "notification_update")
            event_count += 1
            yield _sse_event(event_name, event_data)
            logger.info("[notifications-sse] Evento enviado | event=%s user=%s", event_name, session.user_id)
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
        logger.info("[notifications-sse] Cleanup ejecutado y stream cerrado | user=%s channel=%s", session.user_id, channel)

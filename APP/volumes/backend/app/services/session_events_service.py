from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import HTTPException, Request, status
from redis.exceptions import RedisError

from core.datetime_utils import normalize_datetime_strings_to_utc_z, utc_isoformat_z, utc_now
from db.redis import get_redis
from schemas.auth import UserSession
from services.sse_instrumentation import new_sse_connection_id, sse_duration_ms, sse_log

logger = logging.getLogger(__name__)

SESSION_PREFIX = "session"
SESSION_EVENTS_PREFIX = "events:auth:sessions"
AUTH_SSE_KEEPALIVE_SEC = 15
AUTH_SSE_VALIDATE_SEC = 5
AUTH_SSE_MAX_CONNECTION_SEC = 55
SESSION_REDIS_TIMEOUT_SEC = 2.0


def get_session_redis_key(user_id: str, jti: str) -> str:
    return f"{SESSION_PREFIX}:{user_id}:{jti}"


def get_session_events_channel(user_id: str) -> str:
    return f"{SESSION_EVENTS_PREFIX}:{user_id}"


async def session_exists(user_id: str, jti: str) -> bool:
    redis = get_redis()
    try:
        exists = await asyncio.wait_for(
            redis.exists(get_session_redis_key(user_id, jti)),
            timeout=SESSION_REDIS_TIMEOUT_SEC,
        )
        return bool(exists)
    except (asyncio.TimeoutError, RedisError) as exc:
        logger.warning(
            "[auth-session] Redis no disponible al validar sesion | user=%s jti=%s error=%s",
            user_id,
            jti,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El servicio de sesiones no está disponible temporalmente.",
        )


async def publish_session_event(
    user_id: str,
    event: str,
    *,
    target_jti: str | None = None,
    actor_jti: str | None = None,
    reason: str | None = None,
    message: str | None = None,
    force_logout: bool = False,
    metadata: dict | None = None,
) -> None:
    redis = get_redis()
    payload = {
        "event": event,
        "user_id": user_id,
        "target_jti": target_jti,
        "actor_jti": actor_jti,
        "reason": reason,
        "message": message,
        "force_logout": force_logout,
        "ts": utc_isoformat_z(utc_now()),
        "metadata": metadata or {},
    }
    try:
        await asyncio.wait_for(
            redis.publish(get_session_events_channel(user_id), json.dumps(normalize_datetime_strings_to_utc_z(payload))),
            timeout=SESSION_REDIS_TIMEOUT_SEC,
        )
    except (asyncio.TimeoutError, RedisError) as exc:
        logger.warning(
            "[auth-session] No se pudo publicar evento de sesion | user=%s event=%s error=%s",
            user_id,
            event,
            exc,
        )


def auth_sse_headers() -> dict:
    return {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
    }


def _auth_sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(normalize_datetime_strings_to_utc_z(data))}\n\n"


async def stream_session_events(session: UserSession, request: Request) -> AsyncGenerator[str, None]:
    connection_id = new_sse_connection_id()
    endpoint = "auth_session_events"
    started_at = time.monotonic()
    event_count = 0
    close_reason = "unknown"
    redis = get_redis()
    pubsub = redis.pubsub()
    channel = get_session_events_channel(session.user_id)
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
        await asyncio.wait_for(pubsub.subscribe(channel), timeout=SESSION_REDIS_TIMEOUT_SEC)
    except (asyncio.TimeoutError, RedisError) as exc:
        close_reason = "redis_subscribe_error"
        sse_log(
            logger,
            "sse.exception",
            level="warning",
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
        logger.warning(
            "[auth-sse] Redis no disponible al suscribir | user=%s jti=%s error=%s",
            session.user_id,
            session.jti,
            exc,
        )
        event_count += 1
        yield _auth_sse_event("error", {"message": "Eventos de sesión no disponibles temporalmente."})
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
            record_id=None,
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
        record_id=None,
        transaction_id=None,
        user_id=session.user_id,
        visitor_session_id=None,
        duration_ms=sse_duration_ms(started_at),
        close_reason=None,
        event_count=event_count,
    )
    logger.info("[auth-sse] Suscrito | user=%s jti=%s", session.user_id, session.jti)

    try:
        last_ping_at = started_at
        last_validation_at = last_ping_at

        while True:
            now = time.monotonic()
            if await request.is_disconnected():
                close_reason = "client_disconnect"
                logger.info("[auth-sse] Cliente desconectado | user=%s jti=%s", session.user_id, session.jti)
                break

            if now - started_at >= AUTH_SSE_MAX_CONNECTION_SEC:
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
                yield _auth_sse_event("keepalive", {"reason": "connection_recycle"})
                break

            if now - last_ping_at >= AUTH_SSE_KEEPALIVE_SEC:
                event_count += 1
                yield _auth_sse_event("keepalive", {})
                last_ping_at = now

            if now - last_validation_at >= AUTH_SSE_VALIDATE_SEC:
                try:
                    exists = await session_exists(session.user_id, session.jti)
                except HTTPException:
                    close_reason = "redis_read_error"
                    event_count += 1
                    yield _auth_sse_event("error", {"message": "Eventos de sesión no disponibles temporalmente."})
                    break
                last_validation_at = now
                if not exists:
                    close_reason = "terminal_event"
                    event_count += 1
                    sse_log(
                        logger,
                        "sse.terminal",
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
                        terminal_event="session_revoked",
                    )
                    yield _auth_sse_event("session_revoked", {
                        "event": "session_revoked",
                        "user_id": session.user_id,
                        "target_jti": session.jti,
                        "reason": "session_unavailable",
                        "message": "Esta sesión ya no está disponible. Vuelve a iniciar sesión para continuar.",
                        "force_logout": True,
                    })
                    break

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
                    record_id=None,
                    transaction_id=None,
                    user_id=session.user_id,
                    visitor_session_id=None,
                    duration_ms=sse_duration_ms(started_at),
                    close_reason=close_reason,
                    event_count=event_count,
                    error_type=type(exc).__name__,
                )
                logger.warning(
                    "[auth-sse] Redis no disponible leyendo eventos | user=%s jti=%s error=%s",
                    session.user_id,
                    session.jti,
                    exc,
                )
                event_count += 1
                yield _auth_sse_event("error", {"message": "Eventos de sesión no disponibles temporalmente."})
                break

            if not msg or msg["type"] != "message":
                await asyncio.sleep(0.1)
                continue

            try:
                event_data = json.loads(msg["data"])
            except (json.JSONDecodeError, TypeError):
                await asyncio.sleep(0.1)
                continue

            target_jti = event_data.get("target_jti")
            if target_jti and target_jti != session.jti:
                await asyncio.sleep(0.1)
                continue

            event_name = event_data.get("event", "session_notice")
            event_count += 1
            yield _auth_sse_event(event_name, event_data)
            logger.info(
                "[auth-sse] Evento enviado | event=%s user=%s jti=%s",
                event_name,
                session.user_id,
                session.jti,
            )

            if event_data.get("force_logout"):
                close_reason = "terminal_event"
                sse_log(
                    logger,
                    "sse.terminal",
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
                    terminal_event=event_name,
                )
                break

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
        logger.info("[auth-sse] Cleanup ejecutado y stream cerrado | user=%s jti=%s", session.user_id, session.jti)

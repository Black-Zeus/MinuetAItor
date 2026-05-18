from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import AsyncGenerator

from db.redis import get_redis
from schemas.auth import UserSession

logger = logging.getLogger(__name__)

SESSION_PREFIX = "session"
SESSION_EVENTS_PREFIX = "events:auth:sessions"
AUTH_SSE_KEEPALIVE_SEC = 15
AUTH_SSE_VALIDATE_SEC = 5


def get_session_redis_key(user_id: str, jti: str) -> str:
    return f"{SESSION_PREFIX}:{user_id}:{jti}"


def get_session_events_channel(user_id: str) -> str:
    return f"{SESSION_EVENTS_PREFIX}:{user_id}"


async def session_exists(user_id: str, jti: str) -> bool:
    redis = get_redis()
    return bool(await redis.exists(get_session_redis_key(user_id, jti)))


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
        "ts": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
    }
    await redis.publish(get_session_events_channel(user_id), json.dumps(payload))


def auth_sse_headers() -> dict:
    return {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
    }


def _auth_sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def stream_session_events(session: UserSession) -> AsyncGenerator[str, None]:
    redis = await get_redis()
    pubsub = redis.pubsub()
    channel = get_session_events_channel(session.user_id)
    await pubsub.subscribe(channel)
    logger.info("[auth-sse] Suscrito | user=%s jti=%s", session.user_id, session.jti)

    try:
        last_ping_at = time.monotonic()
        last_validation_at = last_ping_at

        while True:
            now = time.monotonic()
            if now - last_ping_at >= AUTH_SSE_KEEPALIVE_SEC:
                yield _auth_sse_event("keepalive", {})
                last_ping_at = now

            if now - last_validation_at >= AUTH_SSE_VALIDATE_SEC:
                exists = await session_exists(session.user_id, session.jti)
                last_validation_at = now
                if not exists:
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
            yield _auth_sse_event(event_name, event_data)
            logger.info(
                "[auth-sse] Evento enviado | event=%s user=%s jti=%s",
                event_name,
                session.user_id,
                session.jti,
            )

            if event_data.get("force_logout"):
                break

            await asyncio.sleep(0.1)
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:
            pass
        logger.info("[auth-sse] Stream cerrado | user=%s jti=%s", session.user_id, session.jti)

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import AsyncGenerator

from db.redis import get_redis
from schemas.auth import UserSession

NOTIFICATION_EVENTS_PREFIX = "events:notifications"
NOTIFICATION_SSE_KEEPALIVE_SEC = 15


def get_notification_events_channel(user_id: str) -> str:
    return f"{NOTIFICATION_EVENTS_PREFIX}:{user_id}"


def notification_sse_headers() -> dict:
    return {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
    }


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def publish_notification_event(user_id: str, event: str, payload: dict) -> None:
    redis = get_redis()
    body = {
        "event": event,
        "user_id": user_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        **(payload or {}),
    }
    await redis.publish(get_notification_events_channel(user_id), json.dumps(body))


async def stream_user_notifications(session: UserSession) -> AsyncGenerator[str, None]:
    redis = await get_redis()
    pubsub = redis.pubsub()
    channel = get_notification_events_channel(session.user_id)
    await pubsub.subscribe(channel)

    try:
        last_ping_at = time.monotonic()

        while True:
            now = time.monotonic()
            if now - last_ping_at >= NOTIFICATION_SSE_KEEPALIVE_SEC:
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
            yield _sse_event(event_name, event_data)
            await asyncio.sleep(0.1)
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:
            pass

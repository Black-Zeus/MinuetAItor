from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import AsyncGenerator

from core.datetime_utils import utc_now
from db.redis import get_redis
from schemas.auth import UserSession

logger = logging.getLogger(__name__)

BACKUP_EVENTS_CHANNEL = "events:system:backups"
BACKUP_SSE_KEEPALIVE_SEC = 15
BACKUP_SSE_MAX_CONNECTION_SEC = 55


def get_backup_events_channel() -> str:
    return BACKUP_EVENTS_CHANNEL


def backup_sse_headers() -> dict:
    return {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
    }


def _backup_sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def publish_backup_event(
    *,
    status: str,
    scope: str,
    action: str,
    message: str,
    trigger: str,
    operation_id: str | None = None,
    job_id: str | None = None,
    artifact_id: str | None = None,
    actor_user_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    redis = get_redis()
    payload = {
        "event": "backup_update",
        "status": str(status or "").strip() or "info",
        "scope": str(scope or "").strip(),
        "action": str(action or "").strip(),
        "message": str(message or "").strip(),
        "trigger": str(trigger or "").strip() or "unknown",
        "operation_id": operation_id,
        "job_id": job_id,
        "artifact_id": artifact_id,
        "actor_user_id": actor_user_id,
        "ts": utc_now().isoformat(),
        "metadata": metadata or {},
    }
    await redis.publish(get_backup_events_channel(), json.dumps(payload))


async def stream_system_backup_events(session: UserSession) -> AsyncGenerator[str, None]:
    redis = get_redis()
    pubsub = redis.pubsub()
    channel = get_backup_events_channel()
    await pubsub.subscribe(channel)
    logger.info("[backup-sse] Suscrito | user=%s channel=%s", session.user_id, channel)

    try:
        started_at = time.monotonic()
        last_ping_at = started_at

        while True:
            now = time.monotonic()
            if now - started_at >= BACKUP_SSE_MAX_CONNECTION_SEC:
                yield _backup_sse_event("keepalive", {"reason": "connection_recycle"})
                break

            if now - last_ping_at >= BACKUP_SSE_KEEPALIVE_SEC:
                yield _backup_sse_event("keepalive", {})
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

            yield _backup_sse_event(event_data.get("event", "backup_update"), event_data)
            logger.info(
                "[backup-sse] Evento enviado | event=%s status=%s scope=%s user=%s",
                event_data.get("event", "backup_update"),
                event_data.get("status"),
                event_data.get("scope"),
                session.user_id,
            )
            await asyncio.sleep(0.1)
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:
            pass
        logger.info("[backup-sse] Stream cerrado | user=%s channel=%s", session.user_id, channel)

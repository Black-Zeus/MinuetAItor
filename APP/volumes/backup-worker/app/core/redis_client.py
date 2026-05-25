from __future__ import annotations

import redis.asyncio as aioredis

from core.config import settings


_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            db=settings.redis_db,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=10,
            socket_keepalive=True,
            health_check_interval=30,
            retry_on_timeout=True,
        )
    await _client.ping()
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None

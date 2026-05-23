# db/redis.py
import redis.asyncio as aioredis
from core.config import settings

_redis_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            decode_responses=True,
            socket_connect_timeout=settings.redis_socket_connect_timeout,
            socket_timeout=settings.redis_socket_timeout,
            socket_keepalive=True,
            health_check_interval=30,
        )
    return _redis_client


async def close_redis() -> None:
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None

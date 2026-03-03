# core/redis_client.py
"""
Cliente Redis async compartido por todo el worker.
Una sola conexión, inicializada al arranque.
"""
import asyncio
import redis.asyncio as aioredis

from core.config import settings
from core.logging_config import get_logger

logger = get_logger("worker.redis")

_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """
    Retorna el cliente Redis global.
    Si no existe o está caído, lo (re)crea con reintentos.
    """
    global _client

    while True:
        try:
            if _client is None:
                _client = aioredis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    db=settings.REDIS_DB,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True,
                )

            await _client.ping()
            return _client

        except (aioredis.ConnectionError, aioredis.TimeoutError) as e:
            logger.error("Redis no disponible | error=%s | reintentando en 5s...", e)
            _client = None
            await asyncio.sleep(5)


async def close_redis() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None
        logger.info("Conexión Redis cerrada.")
# services/redis_minute_cache.py
import json
import logging
from datetime import datetime, timezone
from db.redis import get_redis

logger = logging.getLogger(__name__)

PROVIDER = "openai"


async def get_cached_file_id(sha256: str) -> str | None:
    r = await get_redis()
    key = f"file:{PROVIDER}:{sha256}"
    data = await r.get(key)
    if data:
        parsed = json.loads(data)
        logger.info(f"Cache HIT file_id para sha256={sha256[:8]}...")
        return parsed["file_id"]
    return None


async def cache_file_id(sha256: str, file_id: str, ttl_days: int = 30) -> None:
    r = await get_redis()
    key = f"file:{PROVIDER}:{sha256}"
    payload = json.dumps({"file_id": file_id, "uploaded_at": datetime.now(timezone.utc).isoformat()})
    await r.setex(key, ttl_days * 86400, payload)
    logger.info(f"Cache STORE file_id={file_id} para sha256={sha256[:8]}...")


async def get_transaction_status(transaction_id: str) -> dict | None:
    r = await get_redis()
    key = f"tx:{transaction_id}"
    data = await r.get(key)
    return json.loads(data) if data else None


async def set_transaction_status(transaction_id: str, status: str, ttl_hours: int = 24, **extra) -> None:
    r = await get_redis()
    key = f"tx:{transaction_id}"
    payload = json.dumps({
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **extra
    })
    await r.setex(key, ttl_hours * 3600, payload)


async def acquire_lock(transaction_id: str, ttl_seconds: int = 30) -> bool:
    r = await get_redis()
    key = f"lock:{transaction_id}"
    result = await r.set(key, "1", ex=ttl_seconds, nx=True)
    return result is not None


async def check_rate_limit(client_ip: str, limit: int = 20) -> bool:
    """Retorna True si está dentro del límite, False si lo superó."""
    from datetime import date
    r = await get_redis()
    today = date.today().strftime("%Y%m%d")
    key = f"rate:{client_ip}:{today}"
    count = await r.incr(key)
    if count == 1:
        await r.expire(key, 86400)
    return count <= limit
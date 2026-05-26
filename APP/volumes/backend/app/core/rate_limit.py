from __future__ import annotations

import hashlib

from fastapi import HTTPException, status

from db.redis import get_redis


def rate_limit_key(scope: str, *parts: object) -> str:
    raw = "|".join(str(part or "").strip().lower() for part in parts)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"rate-limit:{scope}:{digest}"


async def enforce_rate_limit(
    key: str,
    *,
    limit: int,
    window_seconds: int,
    message: str = "Demasiados intentos. Intenta nuevamente más tarde.",
) -> None:
    redis = get_redis()
    count = await redis.incr(key)
    if int(count) == 1:
        await redis.expire(key, int(window_seconds))
    if int(count) > int(limit):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=message,
            headers={"Retry-After": str(int(window_seconds))},
        )

from __future__ import annotations

import json
import logging

from db.redis import get_redis

logger = logging.getLogger(__name__)


async def enqueue_job(queue: str, job: dict) -> None:
    redis = get_redis()
    await redis.rpush(queue, json.dumps(job))
    logger.info("[minutes] Job queued | queue=%s type=%s", queue, job.get("type"))


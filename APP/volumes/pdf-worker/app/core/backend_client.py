from __future__ import annotations

from typing import Any

import httpx

from core.config import settings
from core.logging_config import get_logger

logger = get_logger("pdf-worker.backend_client")

NOTIFICATIONS_INGEST_PATH = "/internal/v1/notifications/ingest"


async def ingest_notification(body: dict[str, Any]) -> dict[str, Any]:
    url = f"{settings.BACKEND_INTERNAL_URL.rstrip('/')}{NOTIFICATIONS_INGEST_PATH}"
    headers = {
        "Content-Type": "application/json",
        "x-internal-secret": settings.INTERNAL_API_SECRET,
    }

    async with httpx.AsyncClient(timeout=settings.BACKEND_TIMEOUT) as client:
        response = await client.post(url, headers=headers, json=body)
        response.raise_for_status()
        payload = response.json()
        logger.info(
            "Notificación interna registrada desde pdf-worker | type=%s status=%s",
            body.get("notificationType") or body.get("notification_type"),
            response.status_code,
        )
        return payload if isinstance(payload, dict) else {"result": payload}

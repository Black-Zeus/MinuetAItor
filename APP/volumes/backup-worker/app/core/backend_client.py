from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from core.config import settings


logger = logging.getLogger("backup-worker.backend_client")


def post_internal_json(path: str, payload: dict[str, Any], *, timeout: int | None = None) -> dict[str, Any]:
    base_url = str(settings.backend_internal_url or "").rstrip("/")
    if not base_url:
        raise RuntimeError("BACKEND_INTERNAL_URL no configurado.")
    if not settings.internal_api_secret or settings.internal_api_secret == "-":
        raise RuntimeError("INTERNAL_API_SECRET no configurado.")

    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}{path}",
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-Internal-Secret": settings.internal_api_secret,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout or settings.backend_timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Backend interno respondió {exc.code}: {error_body[-1000:]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"No fue posible contactar backend interno: {exc}") from exc

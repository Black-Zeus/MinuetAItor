from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any

ALLOWED_CLOSE_REASONS = {
    "client_disconnect",
    "server_recycle",
    "visitor_session_invalid",
    "auth_invalid",
    "forbidden",
    "not_found",
    "redis_subscribe_error",
    "redis_read_error",
    "terminal_event",
    "stream_timeout",
    "frontend_abort_observed",
    "exception",
    "unknown",
}

SSE_LOG_FIELDS = (
    "connection_id",
    "endpoint",
    "channel",
    "record_id",
    "transaction_id",
    "user_id",
    "visitor_session_id",
    "duration_ms",
    "close_reason",
    "event_count",
)


def new_sse_connection_id() -> str:
    return str(uuid.uuid4())


def sse_duration_ms(started_at: float | None) -> int | None:
    if started_at is None:
        return None
    return max(0, int((time.monotonic() - started_at) * 1000))


def sse_log(logger: logging.Logger, event: str, *, level: str = "info", **fields: Any) -> None:
    payload = {field: fields.get(field) for field in SSE_LOG_FIELDS}
    close_reason = payload.get("close_reason")
    if close_reason and close_reason not in ALLOWED_CLOSE_REASONS:
        payload["close_reason"] = "unknown"
    for key, value in fields.items():
        if key not in payload and key not in {"authorization", "bearer", "jwt", "otp", "payload"}:
            payload[key] = value
    message = f"{event} {json.dumps(payload, sort_keys=True, ensure_ascii=False)}"
    log_method = getattr(logger, level, logger.info)
    log_method(message)

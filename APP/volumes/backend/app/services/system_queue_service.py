from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.datetime_utils import utc_isoformat_z, utc_now
from db.redis import get_redis
from services.system_queue_catalog import QUEUE_DEFINITIONS
from services.system_maintenance_service import get_system_maintenance_singleton

QUEUE_ACTIVITY_HASH = "system:queue:last_activity"
DLQ_QUEUE = "queue:dlq"
DLQ_HISTORY_QUEUE = "queue:dlq:history"
DLQ_HISTORY_MAX_SIZE = 1000
SAFE_QUEUE_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")


def _utcnow_iso() -> str:
    return utc_isoformat_z(utc_now())


def _build_status(queue_name: str, size: int, warning_threshold: int) -> tuple[str, str, str, bool]:
    if queue_name == "queue:dlq":
        if size <= 0:
            return "idle", "Sin fallos pendientes", "active", False
        if size >= warning_threshold:
            return "critical", "Requiere revisión", "danger", True
        return "warning", "Con fallos registrados", "warning", True

    if size <= 0:
        return "idle", "Sin carga", "inactive", False
    if size >= warning_threshold:
        return "warning", "Acumulación alta", "warning", True
    return "active", "Procesando / con carga", "info", False


def _load_queue_monitor_state(raw_value: str | None) -> dict:
    raw = str(raw_value or "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _json_loads(raw_value: Any) -> dict:
    if isinstance(raw_value, bytes):
        raw_value = raw_value.decode("utf-8", errors="replace")
    raw_text = str(raw_value or "")
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        return {"raw": raw_text}
    return parsed if isinstance(parsed, dict) else {"raw": parsed}


def _stable_dlq_item_id(raw_value: Any) -> str:
    if isinstance(raw_value, bytes):
        raw_value = raw_value.decode("utf-8", errors="replace")
    return hashlib.sha256(str(raw_value or "").encode("utf-8")).hexdigest()[:24]


def _normalize_dlq_item(raw_value: Any) -> dict:
    parsed = _json_loads(raw_value)
    return {
        "id": _stable_dlq_item_id(raw_value),
        "job_id": parsed.get("job_id"),
        "type": parsed.get("type"),
        "queue": parsed.get("queue"),
        "attempt": parsed.get("attempt"),
        "failed_at": parsed.get("failed_at"),
        "error": parsed.get("error"),
        "payload": parsed.get("payload") if isinstance(parsed.get("payload"), dict) else {},
        "raw": parsed,
    }


def _validate_requeue_record(record: dict) -> tuple[str, dict]:
    queue_name = str(record.get("queue") or "").strip()
    if not SAFE_QUEUE_RE.fullmatch(queue_name):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El registro DLQ no tiene una cola de reproceso válida.",
        )

    job_type = str(record.get("type") or "").strip()
    if not job_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El registro DLQ no tiene tipo de tarea.",
        )

    payload = record.get("payload")
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El payload del registro DLQ no es válido para reproceso.",
        )

    job = {
        "job_id": record.get("job_id"),
        "type": job_type,
        "queue": queue_name,
        "attempt": 1,
        "payload": payload,
    }
    return queue_name, job


async def _find_dlq_raw_by_id(item_id: str) -> tuple[str | bytes, dict]:
    redis = get_redis()
    raw_items = await redis.lrange(DLQ_QUEUE, 0, -1)
    for raw_item in raw_items:
        if _stable_dlq_item_id(raw_item) == item_id:
            return raw_item, _json_loads(raw_item)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="El registro DLQ ya no está disponible.",
    )


async def _move_dlq_record_to_history(
    *,
    raw_item: str | bytes,
    record: dict,
    action: str,
    requested_by: str | None,
    comment: str | None,
    requeued_to: str | None = None,
) -> int:
    redis = get_redis()
    resolved_at = _utcnow_iso()
    history_record = {
        **record,
        "dlq_resolution": {
            "action": action,
            "resolved_at": resolved_at,
            "resolved_by": requested_by,
            "comment": (comment or "").strip() or None,
            "requeued_to": requeued_to,
        },
    }
    removed = int(await redis.lrem(DLQ_QUEUE, 1, raw_item) or 0)
    if removed:
        await redis.rpush(DLQ_HISTORY_QUEUE, json.dumps(history_record, ensure_ascii=False))
        await redis.ltrim(DLQ_HISTORY_QUEUE, -DLQ_HISTORY_MAX_SIZE, -1)
        await redis.hset(QUEUE_ACTIVITY_HASH, DLQ_QUEUE, resolved_at)
    return removed


async def get_system_queues_status(db: Session) -> dict:
    redis = get_redis()
    settings_obj = get_system_maintenance_singleton(db)
    monitor_state = _load_queue_monitor_state(getattr(settings_obj, "queue_monitor_state_json", None))
    activity_state = await redis.hgetall(QUEUE_ACTIVITY_HASH)
    items: list[dict] = []

    for definition in QUEUE_DEFINITIONS:
        size = int(await redis.llen(definition["queue"]))
        warning_threshold = int(getattr(settings_obj, definition["threshold_attr"]))
        monitoring_enabled = bool(getattr(settings_obj, definition["monitor_attr"]))
        queue_state = monitor_state.get(definition["key"], {}) if isinstance(monitor_state.get(definition["key"]), dict) else {}
        status, status_label, status_tone, is_warning = _build_status(
            definition["queue"],
            size,
            warning_threshold,
        )
        effective_warning = bool(monitoring_enabled) and is_warning
        load_percent = round((size / warning_threshold) * 100, 1) if warning_threshold > 0 else 0.0
        items.append({
            "queue": definition["queue"],
            "label": definition["label"],
            "description": definition["description"],
            "last_activity_at": activity_state.get(definition["queue"]),
            "consumer": definition["consumer"],
            "priority": definition["priority"],
            "size": size,
            "monitoring_enabled": monitoring_enabled,
            "warning_threshold": warning_threshold,
            "load_percent": load_percent,
            "status": status,
            "status_label": status_label,
            "status_tone": status_tone,
            "is_warning": effective_warning,
            "job_types": list(definition["job_types"]),
            "alert_state": {
                "alert_active": bool(queue_state.get("alert_active")) or effective_warning,
                "last_alert_at": queue_state.get("last_alert_at"),
                "last_alert_size": queue_state.get("last_alert_size"),
                "last_alert_mail_sent_at": queue_state.get("last_alert_mail_sent_at"),
                "last_recovered_at": queue_state.get("last_recovered_at"),
                "last_recovered_size": queue_state.get("last_recovered_size"),
                "last_recovery_mail_sent_at": queue_state.get("last_recovery_mail_sent_at"),
            },
        })

    return {
        "refreshed_at": _utcnow_iso(),
        "queues": items,
    }


async def list_dlq_items(limit: int = 50) -> dict:
    redis = get_redis()
    safe_limit = max(1, min(int(limit or 50), 200))
    size = int(await redis.llen(DLQ_QUEUE))
    raw_items = await redis.lrange(DLQ_QUEUE, max(0, size - safe_limit), max(size - 1, 0)) if size else []
    items = [_normalize_dlq_item(raw_item) for raw_item in reversed(raw_items)]
    return {
        "refreshed_at": _utcnow_iso(),
        "size": size,
        "items": items,
    }


async def requeue_dlq_item(item_id: str, *, requested_by: str | None, comment: str | None = None) -> dict:
    redis = get_redis()
    raw_item, record = await _find_dlq_raw_by_id(item_id)
    queue_name, job = _validate_requeue_record(record)
    await redis.rpush(queue_name, json.dumps(job, ensure_ascii=False))
    await redis.hset(QUEUE_ACTIVITY_HASH, queue_name, _utcnow_iso())
    removed = await _move_dlq_record_to_history(
        raw_item=raw_item,
        record=record,
        action="requeued",
        requested_by=requested_by,
        comment=comment,
        requeued_to=queue_name,
    )
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El registro fue reencolado, pero no se pudo cerrar en DLQ. Revisa la bandeja antes de repetir la acción.",
        )
    return {
        "ok": True,
        "action": "requeued",
        "item_id": item_id,
        "job_id": record.get("job_id"),
        "queue": queue_name,
        "message": "La tarea fue enviada nuevamente a su cola de origen.",
    }


async def discard_dlq_item(item_id: str, *, requested_by: str | None, comment: str | None = None) -> dict:
    raw_item, record = await _find_dlq_raw_by_id(item_id)
    removed = await _move_dlq_record_to_history(
        raw_item=raw_item,
        record=record,
        action="discarded",
        requested_by=requested_by,
        comment=comment,
    )
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El registro DLQ cambió antes de completar la acción. Actualiza la bandeja e intenta nuevamente.",
        )
    return {
        "ok": True,
        "action": "discarded",
        "item_id": item_id,
        "job_id": record.get("job_id"),
        "queue": record.get("queue"),
        "message": "La tarea fue marcada como descartada y movida al historial DLQ.",
    }

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from core.datetime_utils import utc_now
from db.redis import get_redis
from services.system_queue_catalog import QUEUE_DEFINITIONS
from services.system_maintenance_service import get_system_maintenance_singleton

QUEUE_ACTIVITY_HASH = "system:queue:last_activity"


def _utcnow_iso() -> str:
    return utc_now().isoformat()


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

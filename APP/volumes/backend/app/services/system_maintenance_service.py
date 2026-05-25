from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
from sqlalchemy import func, inspect
from sqlalchemy.orm import Session, joinedload

from core.config import settings
from core.datetime_utils import utc_now
from core.datetime_utils import utc_now_db
from core.exceptions import BadRequestException
from db.redis import get_redis
from models.roles import Role
from models.system_backups import SystemOperationState
from models.system_maintenance_setting import SystemMaintenanceSetting
from models.user import User
from models.user_roles import UserRole
from schemas.system_maintenance import (
    SystemMaintenanceConfigRequest,
    validate_cron_expression,
)
from services.email_queue import queue_templated_email
from services.notification_center_service import create_in_app_notification
from services.public_url_service import build_public_url
from services.system_maintenance_events_service import publish_maintenance_event
from services.system_queue_catalog import QUEUE_DEFINITIONS
from repositories.audit_repository import write_audit

SCHEDULER_TIMEZONE = "America/Santiago"
MAINTENANCE_QUEUE = "queue:maintenance"
DLQ_QUEUE = "queue:dlq"
SYSTEM_MAINTENANCE_SINGLETON_ID = 1
MAINTENANCE_TICK_LOCK_KEY = "lock:system:maintenance:tick"
MAINTENANCE_TICK_LOCK_TTL_SEC = 90

DEFAULT_SETTINGS = {
    "session_cleanup_enabled": True,
    "session_cleanup_cron": "0 * * * *",
    "session_cleanup_mode": "soft_logout",
    "temp_cleanup_enabled": True,
    "temp_cleanup_cron": "0 3 * * *",
    "temp_cleanup_max_age_days": 7,
    "monitor_maintenance_queue_enabled": True,
    "maintenance_queue_warning_threshold": 25,
    "monitor_minutes_queue_enabled": True,
    "minutes_queue_warning_threshold": 5,
    "monitor_email_queue_enabled": True,
    "email_queue_warning_threshold": 20,
    "monitor_pdf_queue_enabled": True,
    "pdf_queue_warning_threshold": 10,
    "monitor_dlq_enabled": True,
    "dlq_warning_threshold": 10,
    "queue_monitor_state_json": "{}",
}

EXPECTED_SYSTEM_MAINTENANCE_COLUMNS = {
    "session_cleanup_enabled",
    "session_cleanup_cron",
    "session_cleanup_mode",
    "temp_cleanup_enabled",
    "temp_cleanup_cron",
    "temp_cleanup_max_age_days",
    "monitor_maintenance_queue_enabled",
    "maintenance_queue_warning_threshold",
    "monitor_minutes_queue_enabled",
    "minutes_queue_warning_threshold",
    "monitor_email_queue_enabled",
    "email_queue_warning_threshold",
    "monitor_pdf_queue_enabled",
    "pdf_queue_warning_threshold",
    "monitor_dlq_enabled",
    "dlq_warning_threshold",
    "queue_monitor_state_json",
}

MANUAL_ACTIONS = {
    "session_cleanup": {
        "job_action": "cleanup_sessions",
        "runtime_prefix": "session_cleanup",
    },
    "temp_cleanup": {
        "job_action": "cleanup_temp_files",
        "runtime_prefix": "temp_cleanup",
    },
}


def _utcnow() -> datetime:
    return utc_now()


def _localnow() -> datetime:
    return datetime.now(ZoneInfo(SCHEDULER_TIMEZONE))


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


async def _acquire_tick_lock() -> str | None:
    redis = get_redis()
    token = str(uuid.uuid4())
    acquired = await redis.set(
        MAINTENANCE_TICK_LOCK_KEY,
        token,
        ex=MAINTENANCE_TICK_LOCK_TTL_SEC,
        nx=True,
    )
    return token if acquired else None


async def _release_tick_lock(token: str | None) -> None:
    if not token:
        return
    redis = get_redis()
    current = await redis.get(MAINTENANCE_TICK_LOCK_KEY)
    if current == token:
        await redis.delete(MAINTENANCE_TICK_LOCK_KEY)


def _is_missing_table_error(exc: Exception) -> bool:
    text_value = str(exc).lower()
    return (
        "system_maintenance_settings" in text_value
        and ("doesn't exist" in text_value or "does not exist" in text_value or "no such table" in text_value)
    )


def _read_system_maintenance_columns(db: Session) -> set[str] | None:
    try:
        inspector = inspect(db.get_bind())
        return {str(column.get("name")) for column in inspector.get_columns(SystemMaintenanceSetting.__tablename__)}
    except Exception:
        return None


def ensure_system_maintenance_schema_access(db: Session) -> None:
    db.query(SystemMaintenanceSetting.id).limit(1).first()
    existing_columns = _read_system_maintenance_columns(db)
    if existing_columns is None:
        return

    missing_columns = sorted(EXPECTED_SYSTEM_MAINTENANCE_COLUMNS - existing_columns)
    if missing_columns:
        raise BadRequestException(
            "La configuración de mantenimiento quedó desfasada respecto del código actual. "
            "Aplica los scripts SQL 20260517_1920_alter_system_maintenance_settings_queue_thresholds.sql "
            "y 20260517_1950_alter_system_maintenance_queue_monitoring.sql antes de usar este módulo."
        )


def _require_schema(db: Session) -> None:
    try:
        ensure_system_maintenance_schema_access(db)
    except BadRequestException:
        raise
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_table_error(exc):
            raise BadRequestException(
                "La tabla de mantenimiento del sistema aún no está disponible. Aplica el esquema antes de usar este módulo."
            )
        raise


def _user_ref(user_obj) -> dict | None:
    if not user_obj:
        return None
    return {
        "id": str(user_obj.id),
        "username": getattr(user_obj, "username", None),
        "full_name": getattr(user_obj, "full_name", None),
    }


def _actor_snapshot(db: Session, user_id: str | None) -> dict | None:
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"id": str(user_id), "username": None, "full_name": None}
    return _user_ref(user)


def _marker_path() -> Path:
    return Path(settings.maintenance_state_file)


def _read_operation_marker() -> dict | None:
    path = _marker_path()
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _write_operation_marker(data: dict) -> None:
    path = _marker_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _clear_operation_marker() -> None:
    _marker_path().unlink(missing_ok=True)


def _get_operation_state_row(db: Session) -> SystemOperationState | None:
    try:
        return db.query(SystemOperationState).filter(SystemOperationState.id == 1).first()
    except Exception:
        return None


def _operation_state_response_from_marker(marker: dict) -> dict:
    actor = marker.get("actor") if isinstance(marker.get("actor"), dict) else None
    return {
        "mode": str(marker.get("mode") or "maintenance"),
        "operation_id": marker.get("operationId"),
        "operation_type": marker.get("operationType") or marker.get("operation_type"),
        "reason": marker.get("reason"),
        "started_by": {
            "id": str(actor.get("id") or actor.get("user_id") or actor.get("userId") or ""),
            "username": actor.get("username"),
            "full_name": actor.get("full_name") or actor.get("fullName"),
        } if actor else None,
        "started_at": marker.get("startedAt"),
        "source": "marker_file",
    }


def get_system_operation_state(db: Session) -> dict:
    marker = _read_operation_marker()
    if marker:
        return _operation_state_response_from_marker(marker)

    row = _get_operation_state_row(db)
    if not row or str(row.mode or "normal") == "normal":
        return {
            "mode": "normal",
            "operation_id": None,
            "operation_type": None,
            "reason": None,
            "started_by": None,
            "started_at": None,
            "source": "default",
        }

    actor = None
    try:
        raw_actor = json.loads(row.started_by_snapshot_json or "{}")
        if isinstance(raw_actor, dict):
            actor = {
                "id": str(raw_actor.get("id") or raw_actor.get("user_id") or raw_actor.get("userId") or ""),
                "username": raw_actor.get("username"),
                "full_name": raw_actor.get("full_name") or raw_actor.get("fullName"),
            }
    except Exception:
        actor = None
    return {
        "mode": row.mode,
        "operation_id": row.operation_id,
        "operation_type": row.operation_type,
        "reason": row.reason,
        "started_by": actor,
        "started_at": _iso(row.started_at),
        "source": "database",
    }


def set_system_operation_mode(
    db: Session,
    *,
    mode: str,
    reason: str | None,
    actor_user_id: str,
) -> dict:
    normalized_mode = str(mode or "").strip()
    if normalized_mode not in {"normal", "read_only", "maintenance"}:
        raise BadRequestException("El modo operativo solicitado no es válido.")

    actor = _actor_snapshot(db, actor_user_id)
    now = utc_now_db()
    row = _get_operation_state_row(db)
    if not row:
        row = SystemOperationState(id=1)
        db.add(row)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            row = _get_operation_state_row(db)
            if not row:
                raise

    previous_state = {
        "mode": row.mode if row else "normal",
        "operationId": row.operation_id if row else None,
        "operationType": row.operation_type if row else None,
        "reason": row.reason if row else None,
        "startedBy": row.started_by if row else None,
        "startedAt": _iso(row.started_at) if row else None,
    }

    if normalized_mode == "normal":
        previous_operation_id = row.operation_id
        row.mode = "normal"
        row.operation_id = None
        row.operation_type = None
        row.reason = None
        row.started_by = None
        row.started_by_snapshot_json = None
        row.allowed_session_jti = None
        row.started_at = None
        row.expires_at = None
        row.metadata_json = None
        row.updated_at = now
        _clear_operation_marker()
        audit_action = "system_operation_normalized"
        audit_entity_id = previous_operation_id
        audit_details = {
            "mode": "normal",
            "reason": reason or "Modo normal restaurado administrativamente.",
            "previousState": previous_state,
            "actor": actor,
            "changedAt": now.replace(tzinfo=timezone.utc).isoformat(),
        }
    else:
        operation_id = str(uuid.uuid4())
        operation_type = "manual_read_only" if normalized_mode == "read_only" else "manual_maintenance"
        marker = {
            "mode": normalized_mode,
            "operationId": operation_id,
            "operationType": operation_type,
            "reason": reason or ("Modo solo lectura activado administrativamente." if normalized_mode == "read_only" else "Modo mantenimiento activado administrativamente."),
            "status": "running",
            "actor": actor,
            "startedAt": now.replace(tzinfo=timezone.utc).isoformat(),
        }
        row.mode = normalized_mode
        row.operation_id = operation_id
        row.operation_type = operation_type
        row.reason = marker["reason"]
        row.started_by = actor_user_id
        row.started_by_snapshot_json = json.dumps(actor, ensure_ascii=False, sort_keys=True) if actor else None
        row.allowed_session_jti = None
        row.started_at = now
        row.expires_at = None
        row.metadata_json = json.dumps(marker, ensure_ascii=False, sort_keys=True)
        row.updated_at = now
        _write_operation_marker(marker)
        audit_action = "system_read_only_enabled" if normalized_mode == "read_only" else "system_maintenance_enabled"
        audit_entity_id = operation_id
        audit_details = {
            "mode": normalized_mode,
            "operationId": operation_id,
            "operationType": operation_type,
            "reason": marker["reason"],
            "previousState": previous_state,
            "actor": actor,
            "startedAt": marker["startedAt"],
        }

    db.commit()
    write_audit(
        db,
        actor_user_id=actor_user_id,
        action=audit_action,
        entity_type="system_operation_state",
        entity_id=audit_entity_id,
        details=audit_details,
    )
    return get_system_operation_state(db)


def _base_query(db: Session):
    return (
        db.query(SystemMaintenanceSetting)
        .options(
            joinedload(SystemMaintenanceSetting.created_by_user),
            joinedload(SystemMaintenanceSetting.updated_by_user),
        )
    )


def _get_singleton(db: Session, *, actor_user_id: str | None = None) -> SystemMaintenanceSetting:
    _require_schema(db)
    obj = _base_query(db).filter(SystemMaintenanceSetting.id == SYSTEM_MAINTENANCE_SINGLETON_ID).first()
    if obj:
        return obj

    now = utc_now_db()
    obj = SystemMaintenanceSetting(
        id=SYSTEM_MAINTENANCE_SINGLETON_ID,
        created_at=now,
        updated_at=now,
        created_by=actor_user_id,
        updated_by=actor_user_id,
        **DEFAULT_SETTINGS,
    )
    db.add(obj)
    try:
        db.commit()
        db.refresh(obj)
    except IntegrityError:
        db.rollback()

    return _base_query(db).filter(SystemMaintenanceSetting.id == SYSTEM_MAINTENANCE_SINGLETON_ID).first()


def _build_config_response(obj: SystemMaintenanceSetting) -> dict:
    return {
        "id": int(obj.id),
        "session_cleanup_enabled": bool(obj.session_cleanup_enabled),
        "session_cleanup_cron": obj.session_cleanup_cron,
        "session_cleanup_mode": obj.session_cleanup_mode,
        "temp_cleanup_enabled": bool(obj.temp_cleanup_enabled),
        "temp_cleanup_cron": obj.temp_cleanup_cron,
        "temp_cleanup_max_age_days": int(obj.temp_cleanup_max_age_days),
        "monitor_maintenance_queue_enabled": bool(obj.monitor_maintenance_queue_enabled),
        "maintenance_queue_warning_threshold": int(obj.maintenance_queue_warning_threshold),
        "monitor_minutes_queue_enabled": bool(obj.monitor_minutes_queue_enabled),
        "minutes_queue_warning_threshold": int(obj.minutes_queue_warning_threshold),
        "monitor_email_queue_enabled": bool(obj.monitor_email_queue_enabled),
        "email_queue_warning_threshold": int(obj.email_queue_warning_threshold),
        "monitor_pdf_queue_enabled": bool(obj.monitor_pdf_queue_enabled),
        "pdf_queue_warning_threshold": int(obj.pdf_queue_warning_threshold),
        "monitor_dlq_enabled": bool(obj.monitor_dlq_enabled),
        "dlq_warning_threshold": int(obj.dlq_warning_threshold),
        "created_at": _iso(obj.created_at),
        "updated_at": _iso(obj.updated_at),
        "created_by": _user_ref(obj.created_by_user),
        "updated_by": _user_ref(obj.updated_by_user),
    }


def _build_runtime_status(obj: SystemMaintenanceSetting, prefix: str) -> dict:
    return {
        "last_enqueued_at": _iso(getattr(obj, f"last_{prefix}_enqueued_at")),
        "last_started_at": _iso(getattr(obj, f"last_{prefix}_started_at")),
        "last_finished_at": _iso(getattr(obj, f"last_{prefix}_finished_at")),
        "last_status": getattr(obj, f"last_{prefix}_status"),
        "last_message": getattr(obj, f"last_{prefix}_message"),
        "affected_count": getattr(obj, f"last_{prefix}_affected_count"),
    }


def _queue_status_dict(queue: str, size: int, monitoring_enabled: bool, warning_threshold: int) -> dict:
    return {
        "queue": queue,
        "size": int(size),
        "monitoring_enabled": bool(monitoring_enabled),
        "warning_threshold": int(warning_threshold),
        "is_warning": bool(monitoring_enabled) and int(size) >= int(warning_threshold),
    }


def _load_queue_monitor_state(obj: SystemMaintenanceSetting) -> dict:
    raw = str(getattr(obj, "queue_monitor_state_json", "") or "").strip()
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _save_queue_monitor_state(obj: SystemMaintenanceSetting, state: dict) -> None:
    obj.queue_monitor_state_json = json.dumps(state or {}, ensure_ascii=False)


def _queue_dashboard_url(db: Session | None = None) -> str:
    return build_public_url(db, "/settings/system")


def _alert_level_for_queue(queue_key: str) -> str:
    return "error" if queue_key == "dlq" else "warning"


def _build_queue_alert_copy(definition: dict, *, size: int, warning_threshold: int) -> tuple[str, str]:
    if definition["key"] == "dlq":
        return (
            f"DLQ con jobs pendientes de revisión",
            f"La cola {definition['queue']} registra {size} job(s) fallidos y superó el umbral configurado de {warning_threshold}.",
        )

    return (
        f"Alerta en cola {definition['label']}",
        f"La cola {definition['queue']} alcanzó {size} job(s) y superó el umbral configurado de {warning_threshold}.",
    )


def _build_queue_alert_mail_context(
    definition: dict,
    *,
    size: int,
    warning_threshold: int,
    detected_at: datetime,
    db: Session | None = None,
) -> dict:
    return {
        "QUEUE_LABEL": definition["label"],
        "QUEUE_NAME": definition["queue"],
        "QUEUE_PRIORITY": definition["priority"],
        "QUEUE_CONSUMER": definition["consumer"],
        "CURRENT_SIZE": size,
        "WARNING_THRESHOLD": warning_threshold,
        "DETECTED_AT": detected_at.astimezone(ZoneInfo(SCHEDULER_TIMEZONE)).strftime("%d/%m/%Y %H:%M"),
        "SYSTEM_MODULE_URL": _queue_dashboard_url(db),
    }


def _build_queue_recovery_mail_context(
    definition: dict,
    *,
    size: int,
    warning_threshold: int,
    recovered_at: datetime,
    db: Session | None = None,
) -> dict:
    return {
        "QUEUE_LABEL": definition["label"],
        "QUEUE_NAME": definition["queue"],
        "QUEUE_PRIORITY": definition["priority"],
        "QUEUE_CONSUMER": definition["consumer"],
        "CURRENT_SIZE": size,
        "WARNING_THRESHOLD": warning_threshold,
        "RECOVERED_AT": recovered_at.astimezone(ZoneInfo(SCHEDULER_TIMEZONE)).strftime("%d/%m/%Y %H:%M"),
        "SYSTEM_MODULE_URL": _queue_dashboard_url(db),
    }


def _get_admin_email_recipients(db: Session) -> list[str]:
    rows = (
        db.query(User.email)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .filter(
            func.upper(Role.code) == "ADMIN",
            Role.is_active.is_(True),
            Role.deleted_at.is_(None),
            UserRole.deleted_at.is_(None),
            User.deleted_at.is_(None),
            User.is_active.is_(True),
            User.email.isnot(None),
        )
        .distinct()
        .all()
    )
    return [str(row.email).strip() for row in rows if str(getattr(row, "email", "") or "").strip()]


async def _notify_queue_threshold_exceeded(
    db: Session,
    definition: dict,
    *,
    size: int,
    warning_threshold: int,
    detected_at: datetime,
) -> bool:
    title, message = _build_queue_alert_copy(
        definition,
        size=size,
        warning_threshold=warning_threshold,
    )
    await create_in_app_notification(
        db,
        notification_type="system.queue.threshold_exceeded",
        title=title,
        message=message,
        level=_alert_level_for_queue(definition["key"]),
        tags=[
            "system",
            "queue",
            "alert",
            definition["tag"],
            "system.queue.threshold_exceeded",
        ],
        role_codes=["ADMIN"],
        scope_type="system_queue",
        scope_id=definition["queue"],
        action_url=_queue_dashboard_url(db),
        metadata={
            "queue": definition["queue"],
            "queue_label": definition["label"],
            "queue_key": definition["key"],
            "size": int(size),
            "warning_threshold": int(warning_threshold),
        },
    )

    admin_emails = _get_admin_email_recipients(db)
    if not admin_emails:
        return False

    try:
        await queue_templated_email(
            to=admin_emails,
            template_id="system_queue_alert",
            template_context=_build_queue_alert_mail_context(
                definition,
                size=size,
                warning_threshold=warning_threshold,
                detected_at=detected_at,
                db=db,
            ),
            subject=f"Alerta operativa · {definition['label']} superó umbral",
        )
        return True
    except Exception:
        # No bloquea el tick de mantenimiento.
        return False


async def _notify_queue_threshold_recovered(
    db: Session,
    definition: dict,
    *,
    size: int,
    warning_threshold: int,
    recovered_at: datetime,
) -> bool:
    await create_in_app_notification(
        db,
        notification_type="system.queue.threshold_recovered",
        title=f"Cola {definition['label']} normalizada",
        message=(
            f"La cola {definition['queue']} volvió a un nivel normal con {size} job(s), "
            f"por debajo del umbral configurado de {warning_threshold}."
        ),
        level="success",
        tags=[
            "system",
            "queue",
            "recovery",
            definition["tag"],
            "system.queue.threshold_recovered",
        ],
        role_codes=["ADMIN"],
        scope_type="system_queue",
        scope_id=definition["queue"],
        action_url=_queue_dashboard_url(db),
        metadata={
            "queue": definition["queue"],
            "queue_label": definition["label"],
            "queue_key": definition["key"],
            "size": int(size),
            "warning_threshold": int(warning_threshold),
            "state": "recovered",
        },
    )

    admin_emails = _get_admin_email_recipients(db)
    if not admin_emails:
        return False

    try:
        await queue_templated_email(
            to=admin_emails,
            template_id="system_queue_recovered",
            template_context=_build_queue_recovery_mail_context(
                definition,
                size=size,
                warning_threshold=warning_threshold,
                recovered_at=recovered_at,
                db=db,
            ),
            subject=f"Normalización operativa · {definition['label']} volvió a nivel normal",
        )
        return True
    except Exception:
        return False


async def _process_queue_observability(db: Session, obj: SystemMaintenanceSetting, *, current_utc_dt: datetime) -> list[dict]:
    redis = get_redis()
    state = _load_queue_monitor_state(obj)
    triggered: list[dict] = []

    for definition in QUEUE_DEFINITIONS:
        monitor_attr = definition["monitor_attr"]
        threshold_attr = definition["threshold_attr"]
        queue_name = definition["queue"]
        queue_key = definition["key"]
        monitoring_enabled = bool(getattr(obj, monitor_attr))
        warning_threshold = int(getattr(obj, threshold_attr))
        size = int(await redis.llen(queue_name))
        queue_state = state.get(queue_key, {}) if isinstance(state.get(queue_key), dict) else {}
        was_alert_active = bool(queue_state.get("alert_active"))
        is_alert_active = bool(monitoring_enabled) and size >= warning_threshold

        if is_alert_active and not was_alert_active:
            alert_mail_sent = await _notify_queue_threshold_exceeded(
                db,
                definition,
                size=size,
                warning_threshold=warning_threshold,
                detected_at=current_utc_dt,
            )
            triggered.append({
                "queue": queue_name,
                "size": size,
                "warning_threshold": warning_threshold,
            })

        queue_state["alert_active"] = is_alert_active
        if is_alert_active and not was_alert_active:
            queue_state["last_alert_at"] = current_utc_dt.isoformat()
            queue_state["last_alert_size"] = int(size)
            if alert_mail_sent:
                queue_state["last_alert_mail_sent_at"] = current_utc_dt.isoformat()
        elif not is_alert_active and was_alert_active:
            queue_state["last_recovered_at"] = current_utc_dt.isoformat()
            queue_state["last_recovered_size"] = int(size)
            if queue_state.get("last_alert_mail_sent_at"):
                recovery_mail_sent = await _notify_queue_threshold_recovered(
                    db,
                    definition,
                    size=size,
                    warning_threshold=warning_threshold,
                    recovered_at=current_utc_dt,
                )
                if recovery_mail_sent:
                    queue_state["last_recovery_mail_sent_at"] = current_utc_dt.isoformat()
        state[queue_key] = queue_state

    _save_queue_monitor_state(obj, state)
    return triggered


def _mark_runtime_enqueued(
    obj: SystemMaintenanceSetting,
    prefix: str,
    *,
    slot: str,
    enqueued_at: datetime,
    message: str,
) -> None:
    setattr(obj, f"last_{prefix}_enqueued_slot", slot)
    setattr(obj, f"last_{prefix}_enqueued_at", enqueued_at)
    setattr(obj, f"last_{prefix}_started_at", None)
    setattr(obj, f"last_{prefix}_finished_at", None)
    setattr(obj, f"last_{prefix}_status", "queued")
    setattr(obj, f"last_{prefix}_message", message[:500])
    setattr(obj, f"last_{prefix}_affected_count", None)


def _split_step_segment(segment: str) -> tuple[str, int | None]:
    parts = str(segment or "").split("/")
    base = parts[0]
    step = int(parts[1]) if len(parts) == 2 else None
    return base, step


def _field_part_matches(part: str, current_value: int, min_value: int, max_value: int) -> bool:
    base, step = _split_step_segment(part)

    if base == "*":
        if step is None:
            return True
        return (current_value - min_value) % step == 0

    if "-" in base:
        start_raw, end_raw = base.split("-", 1)
        start = int(start_raw)
        end = int(end_raw)
        if current_value < start or current_value > end:
            return False
        if step is None:
            return True
        return (current_value - start) % step == 0

    target = int(base)
    if step is None:
        return current_value == target
    if current_value < target or current_value > max_value:
        return False
    return (current_value - target) % step == 0


def _field_matches(expression: str, current_value: int, min_value: int, max_value: int) -> bool:
    return any(
        _field_part_matches(part.strip(), current_value, min_value, max_value)
        for part in str(expression or "").split(",")
        if part.strip()
    )


def _cron_matches(cron_expression: str, current_local_dt: datetime) -> bool:
    normalized = validate_cron_expression(cron_expression)
    minute, hour, day_of_month, month, day_of_week = normalized.split(" ")
    weekday = (current_local_dt.weekday() + 1) % 7
    return all(
        (
            _field_matches(minute, current_local_dt.minute, 0, 59),
            _field_matches(hour, current_local_dt.hour, 0, 23),
            _field_matches(day_of_month, current_local_dt.day, 1, 31),
            _field_matches(month, current_local_dt.month, 1, 12),
            _field_matches(day_of_week, weekday, 0, 6),
        )
    )


def _current_slot(current_local_dt: datetime) -> str:
    return current_local_dt.strftime("%Y%m%d%H%M")


async def _enqueue_maintenance_job(action: str, payload: dict) -> str:
    job_id = str(uuid.uuid4())
    job = {
        "job_id": job_id,
        "type": action,
        "queue": MAINTENANCE_QUEUE,
        "attempt": 1,
        "payload": {
            "action": action,
            **payload,
        },
    }
    redis = get_redis()
    await redis.rpush(MAINTENANCE_QUEUE, json.dumps(job))
    return job_id


async def _enqueue_manual_action(
    db: Session,
    obj: SystemMaintenanceSetting,
    *,
    action_key: str,
    requested_by_id: str,
) -> dict:
    if action_key not in MANUAL_ACTIONS:
        raise BadRequestException("La rutina solicitada no es válida.")

    action_meta = MANUAL_ACTIONS[action_key]
    current_local_dt = _localnow()
    current_slot = _current_slot(current_local_dt)
    current_utc_dt = _utcnow()

    if action_key == "session_cleanup":
        message = f"Limpieza de sesiones encolada manualmente con modo '{obj.session_cleanup_mode}'."
        payload = {
            "mode": obj.session_cleanup_mode,
            "scheduled_slot": current_slot,
            "trigger_source": "manual",
            "requested_by_id": requested_by_id,
        }
    else:
        message = f"Limpieza de temporales encolada manualmente con retención de {int(obj.temp_cleanup_max_age_days)} día(s)."
        payload = {
            "max_age_days": int(obj.temp_cleanup_max_age_days),
            "scheduled_slot": current_slot,
            "trigger_source": "manual",
            "requested_by_id": requested_by_id,
        }

    job_id = await _enqueue_maintenance_job(action_meta["job_action"], payload)
    _mark_runtime_enqueued(
        obj,
        action_meta["runtime_prefix"],
        slot=current_slot,
        enqueued_at=current_utc_dt,
        message=message,
    )
    db.commit()
    await publish_maintenance_event(
        status="queued",
        scope=action_key,
        action=action_meta["job_action"],
        message=message,
        trigger="manual",
        job_id=job_id,
        scheduled_slot=current_slot,
        actor_user_id=requested_by_id,
    )

    return {
        "action": action_meta["job_action"],
        "job_id": job_id,
        "requested_at": current_utc_dt.isoformat(),
        "scheduled_slot": current_slot,
        "trigger": "manual",
        "message": message,
    }


def get_system_maintenance_settings(db: Session) -> dict:
    obj = _get_singleton(db)
    return _build_config_response(obj)


def get_system_maintenance_singleton(db: Session, *, actor_user_id: str | None = None) -> SystemMaintenanceSetting:
    return _get_singleton(db, actor_user_id=actor_user_id)


def update_system_maintenance_settings(
    db: Session,
    body: SystemMaintenanceConfigRequest,
    *,
    updated_by_id: str,
) -> dict:
    obj = _get_singleton(db, actor_user_id=updated_by_id)
    now = utc_now_db()

    obj.session_cleanup_enabled = body.session_cleanup_enabled
    obj.session_cleanup_cron = body.session_cleanup_cron
    obj.session_cleanup_mode = body.session_cleanup_mode
    obj.temp_cleanup_enabled = body.temp_cleanup_enabled
    obj.temp_cleanup_cron = body.temp_cleanup_cron
    obj.temp_cleanup_max_age_days = body.temp_cleanup_max_age_days
    obj.monitor_maintenance_queue_enabled = body.monitor_maintenance_queue_enabled
    obj.maintenance_queue_warning_threshold = body.maintenance_queue_warning_threshold
    obj.monitor_minutes_queue_enabled = body.monitor_minutes_queue_enabled
    obj.minutes_queue_warning_threshold = body.minutes_queue_warning_threshold
    obj.monitor_email_queue_enabled = body.monitor_email_queue_enabled
    obj.email_queue_warning_threshold = body.email_queue_warning_threshold
    obj.monitor_pdf_queue_enabled = body.monitor_pdf_queue_enabled
    obj.pdf_queue_warning_threshold = body.pdf_queue_warning_threshold
    obj.monitor_dlq_enabled = body.monitor_dlq_enabled
    obj.dlq_warning_threshold = body.dlq_warning_threshold
    if not obj.created_by:
        obj.created_by = updated_by_id
    obj.updated_by = updated_by_id
    obj.updated_at = now

    db.commit()
    db.refresh(obj)
    obj = _base_query(db).filter(SystemMaintenanceSetting.id == SYSTEM_MAINTENANCE_SINGLETON_ID).first()
    return _build_config_response(obj)


async def get_system_maintenance_status(db: Session) -> dict:
    obj = _get_singleton(db)
    redis = get_redis()
    minutes_queue_size = int(await redis.llen("queue:minutes"))
    email_queue_size = int(await redis.llen("queue:email"))
    maintenance_queue_size = int(await redis.llen(MAINTENANCE_QUEUE))
    pdf_queue_size = int(await redis.llen("queue:pdf"))
    dlq_size = int(await redis.llen(DLQ_QUEUE))

    return {
        "minutes_queue": _queue_status_dict(
            "queue:minutes",
            minutes_queue_size,
            bool(obj.monitor_minutes_queue_enabled),
            int(obj.minutes_queue_warning_threshold),
        ),
        "email_queue": _queue_status_dict(
            "queue:email",
            email_queue_size,
            bool(obj.monitor_email_queue_enabled),
            int(obj.email_queue_warning_threshold),
        ),
        "maintenance_queue": _queue_status_dict(
            MAINTENANCE_QUEUE,
            maintenance_queue_size,
            bool(obj.monitor_maintenance_queue_enabled),
            int(obj.maintenance_queue_warning_threshold),
        ),
        "pdf_queue": _queue_status_dict(
            "queue:pdf",
            pdf_queue_size,
            bool(obj.monitor_pdf_queue_enabled),
            int(obj.pdf_queue_warning_threshold),
        ),
        "dlq": _queue_status_dict(
            DLQ_QUEUE,
            dlq_size,
            bool(obj.monitor_dlq_enabled),
            int(obj.dlq_warning_threshold),
        ),
        "session_cleanup": _build_runtime_status(obj, "session_cleanup"),
        "temp_cleanup": _build_runtime_status(obj, "temp_cleanup"),
        "operation_state": get_system_operation_state(db),
        "scheduler_timezone": SCHEDULER_TIMEZONE,
    }


async def run_system_maintenance_tick(db: Session) -> dict:
    current_local_dt = _localnow()
    current_slot = _current_slot(current_local_dt)
    current_utc_dt = _utcnow()
    lock_token = await _acquire_tick_lock()

    if not lock_token:
        return {
            "current_slot": current_slot,
            "current_time": current_local_dt.isoformat(),
            "timezone": SCHEDULER_TIMEZONE,
            "enqueued": [],
            "skipped": [
                {
                    "action": "maintenance_tick",
                    "reason": "tick_locked",
                    "job_id": None,
                }
            ],
            "queue_alerts": [],
        }

    try:
        obj = _get_singleton(db)
        enqueued: list[dict] = []
        skipped: list[dict] = []
        events_to_publish: list[dict] = []

        session_due = bool(obj.session_cleanup_enabled) and _cron_matches(obj.session_cleanup_cron, current_local_dt)
        if session_due and obj.last_session_cleanup_enqueued_slot != current_slot:
            job_id = await _enqueue_maintenance_job(
                "cleanup_sessions",
                {
                    "mode": obj.session_cleanup_mode,
                    "scheduled_slot": current_slot,
                },
            )
            _mark_runtime_enqueued(
                obj,
                "session_cleanup",
                slot=current_slot,
                enqueued_at=current_utc_dt,
                message="Limpieza de sesiones encolada por programación.",
            )
            enqueued.append({
                "action": "cleanup_sessions",
                "reason": "cron_match",
                "job_id": job_id,
            })
            events_to_publish.append({
                "status": "queued",
                "scope": "session_cleanup",
                "action": "cleanup_sessions",
                "message": "Limpieza de sesiones encolada por programación.",
                "trigger": "cron",
                "job_id": job_id,
                "scheduled_slot": current_slot,
            })
        else:
            skipped.append({
                "action": "cleanup_sessions",
                "reason": "disabled" if not obj.session_cleanup_enabled else "already_enqueued" if obj.last_session_cleanup_enqueued_slot == current_slot else "not_due",
                "job_id": None,
            })

        temp_due = bool(obj.temp_cleanup_enabled) and _cron_matches(obj.temp_cleanup_cron, current_local_dt)
        if temp_due and obj.last_temp_cleanup_enqueued_slot != current_slot:
            job_id = await _enqueue_maintenance_job(
                "cleanup_temp_files",
                {
                    "max_age_days": int(obj.temp_cleanup_max_age_days),
                    "scheduled_slot": current_slot,
                },
            )
            _mark_runtime_enqueued(
                obj,
                "temp_cleanup",
                slot=current_slot,
                enqueued_at=current_utc_dt,
                message="Limpieza de temporales encolada por programación.",
            )
            enqueued.append({
                "action": "cleanup_temp_files",
                "reason": "cron_match",
                "job_id": job_id,
            })
            events_to_publish.append({
                "status": "queued",
                "scope": "temp_cleanup",
                "action": "cleanup_temp_files",
                "message": "Limpieza de temporales encolada por programación.",
                "trigger": "cron",
                "job_id": job_id,
                "scheduled_slot": current_slot,
            })
        else:
            skipped.append({
                "action": "cleanup_temp_files",
                "reason": "disabled" if not obj.temp_cleanup_enabled else "already_enqueued" if obj.last_temp_cleanup_enqueued_slot == current_slot else "not_due",
                "job_id": None,
            })

        queue_alerts = await _process_queue_observability(
            db,
            obj,
            current_utc_dt=current_utc_dt,
        )
        db.commit()

        for event_payload in events_to_publish:
            await publish_maintenance_event(**event_payload)

        return {
            "current_slot": current_slot,
            "current_time": current_local_dt.isoformat(),
            "timezone": SCHEDULER_TIMEZONE,
            "enqueued": enqueued,
            "skipped": skipped,
            "queue_alerts": queue_alerts,
        }
    finally:
        await _release_tick_lock(lock_token)


async def run_system_maintenance_action_now(
    db: Session,
    *,
    action_key: str,
    requested_by_id: str,
) -> dict:
    obj = _get_singleton(db, actor_user_id=requested_by_id)
    return await _enqueue_manual_action(
        db,
        obj,
        action_key=action_key,
        requested_by_id=requested_by_id,
    )

# handlers/maintenance_handler.py
"""
Handler de jobs de tipo 'maintenance'.

Agrupa tareas de mantenimiento del sistema: backups, limpiezas, etc.
Cada subtipo se despacha internamente por el campo "action" del payload
o por el job.type del envelope.
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from core.backend_client import ingest_notification
from core.config import settings
from core.job import JobEnvelope
from core.logging_config import get_logger
from core.redis_client import get_redis

logger = get_logger("worker.handler.maintenance")

_SessionLocal: sessionmaker | None = None
_MAINTENANCE_EVENTS_CHANNEL = "events:system:maintenance"
_RUNTIME_PREFIX_BY_ACTION = {
    "cleanup_sessions": "session_cleanup",
    "cleanup_temp_files": "temp_cleanup",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_db_session() -> sessionmaker:
    global _SessionLocal
    if _SessionLocal is None:
        engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
        _SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return _SessionLocal


def _update_runtime_started(runtime_prefix: str) -> None:
    SessionLocal = _get_db_session()
    now = _utcnow()
    query = text(
        f"""
        UPDATE system_maintenance_settings
        SET last_{runtime_prefix}_started_at = :now,
            last_{runtime_prefix}_finished_at = NULL,
            last_{runtime_prefix}_status = 'running',
            last_{runtime_prefix}_message = 'Ejecución en curso',
            last_{runtime_prefix}_affected_count = NULL
        WHERE id = 1
        """
    )
    try:
        with SessionLocal() as db:
            db.execute(query, {"now": now})
            db.commit()
    except Exception as exc:
        logger.warning("No se pudo marcar inicio de runtime | prefix=%s err=%s", runtime_prefix, exc)


def _update_runtime_finished(runtime_prefix: str, status: str, message: str, affected_count: int) -> None:
    SessionLocal = _get_db_session()
    now = _utcnow()
    query = text(
        f"""
        UPDATE system_maintenance_settings
        SET last_{runtime_prefix}_finished_at = :now,
            last_{runtime_prefix}_status = :status,
            last_{runtime_prefix}_message = :message,
            last_{runtime_prefix}_affected_count = :affected_count
        WHERE id = 1
        """
    )
    try:
        with SessionLocal() as db:
            db.execute(
                query,
                {
                    "now": now,
                    "status": str(status or "success")[:20],
                    "message": str(message or "")[:500],
                    "affected_count": int(affected_count),
                },
            )
            db.commit()
    except Exception as exc:
        logger.warning("No se pudo marcar fin de runtime | prefix=%s err=%s", runtime_prefix, exc)


async def _publish_runtime_event(
    *,
    status: str,
    scope: str,
    action: str,
    message: str,
    trigger: str,
    job_id: str | None,
    scheduled_slot: str | None,
    affected_count: int | None = None,
    requested_by_id: str | None = None,
) -> None:
    redis = await get_redis()
    payload = {
        "event": "maintenance_update",
        "status": str(status or "").strip() or "info",
        "scope": str(scope or "").strip(),
        "action": str(action or "").strip(),
        "message": str(message or "").strip(),
        "trigger": str(trigger or "").strip() or "unknown",
        "job_id": job_id,
        "scheduled_slot": scheduled_slot,
        "actor_user_id": requested_by_id,
        "affected_count": affected_count,
        "ts": _utcnow().isoformat(),
        "metadata": {},
    }
    await redis.publish(_MAINTENANCE_EVENTS_CHANNEL, json.dumps(payload))


async def _notify_admins(
    *,
    action: str,
    runtime_prefix: str | None,
    status: str,
    message: str,
    trigger: str,
    job_id: str | None,
    affected_count: int | None = None,
    requested_by_id: str | None = None,
) -> None:
    if not runtime_prefix:
        return

    title_map = {
        "cleanup_sessions": "Mantenimiento de sesiones",
        "cleanup_temp_files": "Mantenimiento de temporales",
    }
    title = title_map.get(action, "Mantenimiento del sistema")
    status_label = {
        "running": "en ejecución",
        "success": "finalizado",
        "error": "con error",
    }.get(status, status or "actualizado")

    body = {
        "notificationType": f"system.maintenance.{status}",
        "title": title,
        "message": f"{title} {status_label}. {message}".strip(),
        "level": "error" if status == "error" else ("warning" if status == "running" else "success"),
        "tags": ["system", "maintenance", runtime_prefix, f"system.maintenance.{runtime_prefix}", status],
        "roleCodes": ["ADMIN"],
        "scopeType": "system-maintenance",
        "scopeId": runtime_prefix,
        "actionUrl": "/settings/system?tab=maintenance",
        "actorUserId": requested_by_id,
        "metadata": {
            "action": action,
            "runtimePrefix": runtime_prefix,
            "status": status,
            "trigger": trigger,
            "jobId": job_id,
            "affectedCount": affected_count,
        },
    }

    try:
        await asyncio.to_thread(ingest_notification, body)
    except Exception as exc:
        logger.warning("No se pudo emitir notificación admin de maintenance | action=%s err=%s", action, exc)


async def _handle_db_backup(payload: dict[str, Any]) -> tuple[int, str]:
    target = payload.get("target", "mariadb")
    logger.info("Iniciando backup | target=%s", target)
    await asyncio.sleep(0)
    logger.info("Backup completado | target=%s", target)
    return 0, f"Respaldo placeholder ejecutado para {target}."


async def _handle_cleanup_sessions(payload: dict[str, Any]) -> tuple[int, str]:
    mode = str(payload.get("mode") or "soft_logout").strip() or "soft_logout"
    SessionLocal = _get_db_session()
    query = text(
        """
        SELECT id, user_id, jti
        FROM user_sessions
        WHERE logged_out_at IS NULL
        ORDER BY created_at ASC
        """
    )

    with SessionLocal() as db:
        rows = db.execute(query).mappings().all()

    if not rows:
        return 0, "No había sesiones pendientes de conciliación."

    redis = await get_redis()
    pipeline = redis.pipeline()
    for row in rows:
        pipeline.exists(f"session:{row['user_id']}:{row['jti']}")
    exists_results = await pipeline.execute()

    stale_session_ids = [
        row["id"]
        for row, exists_flag in zip(rows, exists_results)
        if not bool(exists_flag)
    ]

    stale_count = len(stale_session_ids)
    if mode == "archive_only":
        return stale_count, f"Se detectaron {stale_count} sesiones sin presencia en Redis. No se aplicaron cambios."

    if not stale_session_ids:
        return 0, "No se encontraron sesiones para cierre técnico."

    now = _utcnow()
    update_query = text(
        """
        UPDATE user_sessions
        SET logged_out_at = :logged_out_at
        WHERE id = :id
          AND logged_out_at IS NULL
        """
    )
    with SessionLocal() as db:
        for session_id in stale_session_ids:
            db.execute(update_query, {"logged_out_at": now, "id": session_id})
        db.commit()

    if mode == "revoke_idle":
        return stale_count, f"Se aplicó revocación técnica sobre {stale_count} sesiones sin presencia activa en Redis."
    return stale_count, f"Se marcó logout técnico sobre {stale_count} sesiones sin presencia activa en Redis."


async def _handle_cleanup_temp_files(payload: dict[str, Any]) -> tuple[int, str]:
    max_age_days = int(payload.get("max_age_days") or 7)
    if max_age_days < 1:
        raise ValueError("max_age_days debe ser mayor o igual a 1")

    root = Path(settings.TRACE_BASE_DIR)
    if not root.exists():
        return 0, f"El directorio {root} no existe. No hubo archivos para limpiar."

    cutoff_timestamp = time.time() - (max_age_days * 86400)
    deleted_files = 0
    deleted_dirs = 0

    for file_path in root.rglob("*"):
        if not file_path.is_file():
            continue
        try:
            if file_path.stat().st_mtime < cutoff_timestamp:
                file_path.unlink()
                deleted_files += 1
        except FileNotFoundError:
            continue

    for dir_path in sorted((path for path in root.rglob("*") if path.is_dir()), reverse=True):
        try:
            dir_path.rmdir()
            deleted_dirs += 1
        except OSError:
            continue

    return deleted_files, (
        f"Se eliminaron {deleted_files} archivo(s) temporales y {deleted_dirs} directorio(s) vacíos "
        f"con antigüedad superior a {max_age_days} día(s)."
    )


_ACTIONS: dict[str, Any] = {
    "db_backup": _handle_db_backup,
    "cleanup_sessions": _handle_cleanup_sessions,
    "cleanup_temp_files": _handle_cleanup_temp_files,
}


async def handle_maintenance_job(job: JobEnvelope) -> None:
    payload = job.payload
    action = payload.get("action") or job.type

    if not action:
        raise ValueError("No se pudo determinar la acción para el job de maintenance")

    handler = _ACTIONS.get(action)
    if handler is None:
        raise ValueError(f"Acción de maintenance desconocida: {action!r}")

    runtime_prefix = _RUNTIME_PREFIX_BY_ACTION.get(action)
    trigger_source = str(payload.get("trigger_source") or "queue").strip() or "queue"
    scheduled_slot = payload.get("scheduled_slot")
    requested_by_id = payload.get("requested_by_id")

    logger.info(
        "Ejecutando acción de mantenimiento | action=%s job_id=%s type=%s attempt=%d",
        action, job.job_id, job.type, job.attempt,
    )

    if runtime_prefix:
        await asyncio.to_thread(_update_runtime_started, runtime_prefix)
        await _publish_runtime_event(
            status="running",
            scope=runtime_prefix,
            action=action,
            message="Ejecución en curso.",
            trigger=trigger_source,
            job_id=job.job_id,
            scheduled_slot=scheduled_slot,
            requested_by_id=requested_by_id,
        )
        await _notify_admins(
            action=action,
            runtime_prefix=runtime_prefix,
            status="running",
            message="La rutina fue tomada por el worker.",
            trigger=trigger_source,
            job_id=job.job_id,
            requested_by_id=requested_by_id,
        )

    try:
        affected_count, message = await handler(payload)
    except Exception as exc:
        if runtime_prefix:
            await asyncio.to_thread(_update_runtime_finished, runtime_prefix, "error", str(exc), 0)
            await _publish_runtime_event(
                status="error",
                scope=runtime_prefix,
                action=action,
                message=str(exc),
                trigger=trigger_source,
                job_id=job.job_id,
                scheduled_slot=scheduled_slot,
                affected_count=0,
                requested_by_id=requested_by_id,
            )
            await _notify_admins(
                action=action,
                runtime_prefix=runtime_prefix,
                status="error",
                message=str(exc),
                trigger=trigger_source,
                job_id=job.job_id,
                affected_count=0,
                requested_by_id=requested_by_id,
            )
        raise

    if runtime_prefix:
        await asyncio.to_thread(_update_runtime_finished, runtime_prefix, "success", message, affected_count)
        await _publish_runtime_event(
            status="success",
            scope=runtime_prefix,
            action=action,
            message=message,
            trigger=trigger_source,
            job_id=job.job_id,
            scheduled_slot=scheduled_slot,
            affected_count=affected_count,
            requested_by_id=requested_by_id,
        )
        await _notify_admins(
            action=action,
            runtime_prefix=runtime_prefix,
            status="success",
            message=message,
            trigger=trigger_source,
            job_id=job.job_id,
            affected_count=affected_count,
            requested_by_id=requested_by_id,
        )

    logger.info(
        "Acción de mantenimiento completada | action=%s job_id=%s affected_count=%d message=%s",
        action, job.job_id, affected_count, message,
    )

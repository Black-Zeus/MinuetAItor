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
from datetime import datetime, timedelta, timezone
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
_RUN_ACTIVE_OR_DONE_STATUSES = {"running", "success"}
_DANGEROUS_TEMP_ROOTS = {"/", "/app", "/mnt", "/var"}


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


def _mark_run_started(job: JobEnvelope, correlation_id: str | None) -> bool:
    if not job.job_id:
        return True

    SessionLocal = _get_db_session()
    now = _utcnow()
    update_query = text(
        """
        UPDATE system_maintenance_runs
        SET status = 'running',
            started_at = :now,
            finished_at = NULL,
            duration_ms = NULL,
            attempt = :attempt,
            max_attempts = :max_attempts,
            message = 'Ejecución en curso',
            error_code = NULL,
            error_detail = NULL,
            updated_at = :now
        WHERE job_id = :job_id
          AND status NOT IN ('running', 'success')
          AND (
            status IN ('dispatch_pending', 'dispatch_error', 'queued')
            OR (status = 'error' AND :attempt > attempt)
          )
        """
    )
    select_query = text(
        """
        SELECT status, attempt
        FROM system_maintenance_runs
        WHERE job_id = :job_id
        LIMIT 1
        """
    )
    try:
        with SessionLocal() as db:
            result = db.execute(
                update_query,
                {
                    "now": now,
                    "attempt": int(job.attempt or 1),
                    "max_attempts": int(settings.MAX_RETRIES),
                    "job_id": job.job_id,
                },
            )
            db.commit()
            if result.rowcount and result.rowcount > 0:
                return True

            row = db.execute(select_query, {"job_id": job.job_id}).mappings().first()
            if not row:
                return True
            status = str(row.get("status") or "")
            stored_attempt = int(row.get("attempt") or 0)
            if status in _RUN_ACTIVE_OR_DONE_STATUSES or int(job.attempt or 1) <= stored_attempt:
                logger.info(
                    "Job de mantenimiento duplicado omitido | job_id=%s correlation_id=%s status=%s attempt=%d stored_attempt=%d",
                    job.job_id,
                    correlation_id,
                    status,
                    int(job.attempt or 1),
                    stored_attempt,
                )
                return False
            return True
    except Exception as exc:
        logger.warning(
            "No se pudo marcar inicio de run de mantenimiento | job_id=%s correlation_id=%s err=%s",
            job.job_id,
            correlation_id,
            exc,
        )
        return True


def _mark_run_finished(
    job: JobEnvelope,
    *,
    status: str,
    message: str,
    affected_count: int,
    correlation_id: str | None,
    error_code: str | None = None,
    error_detail: str | None = None,
) -> None:
    if not job.job_id:
        return

    SessionLocal = _get_db_session()
    now = _utcnow()
    query = text(
        """
        UPDATE system_maintenance_runs
        SET status = :status,
            finished_at = :now,
            duration_ms = CASE
                WHEN started_at IS NULL THEN NULL
                ELSE TIMESTAMPDIFF(MICROSECOND, started_at, :now) DIV 1000
            END,
            affected_count = :affected_count,
            attempt = :attempt,
            max_attempts = :max_attempts,
            message = :message,
            error_code = :error_code,
            error_detail = :error_detail,
            updated_at = :now
        WHERE job_id = :job_id
        """
    )
    try:
        with SessionLocal() as db:
            db.execute(
                query,
                {
                    "now": now,
                    "status": str(status or "success")[:30],
                    "affected_count": int(affected_count),
                    "attempt": int(job.attempt or 1),
                    "max_attempts": int(settings.MAX_RETRIES),
                    "message": str(message or "")[:700],
                    "error_code": str(error_code or "")[:80] or None,
                    "error_detail": str(error_detail or "")[:2000] or None,
                    "job_id": job.job_id,
                },
            )
            db.commit()
    except Exception as exc:
        logger.warning(
            "No se pudo marcar fin de run de mantenimiento | job_id=%s correlation_id=%s err=%s",
            job.job_id,
            correlation_id,
            exc,
        )


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
        "warning": "finalizado con advertencias",
    }.get(status, status or "actualizado")

    body = {
        "notificationType": f"system.maintenance.{status}",
        "title": title,
        "message": f"{title} {status_label}. {message}".strip(),
        "level": "error" if status == "error" else ("warning" if status in {"running", "warning"} else "success"),
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


async def _handle_cleanup_sessions(payload: dict[str, Any]) -> tuple[int, str, str]:
    mode = str(payload.get("mode") or "soft_logout").strip() or "soft_logout"
    if mode not in {"archive_only", "soft_logout", "revoke_idle"}:
        raise ValueError(f"Modo de limpieza de sesiones no soportado: {mode}")

    grace_minutes = int(
        payload.get(
            "grace_minutes",
            getattr(settings, "MAINTENANCE_SESSION_CLEANUP_GRACE_MINUTES", 240),
        )
        or 240
    )
    batch_size = int(
        payload.get(
            "batch_size",
            getattr(settings, "MAINTENANCE_SESSION_CLEANUP_BATCH_SIZE", 500),
        )
        or 500
    )
    max_affected = int(
        payload.get(
            "max_affected",
            getattr(settings, "MAINTENANCE_SESSION_CLEANUP_MAX_AFFECTED", 100),
        )
        or 100
    )
    grace_minutes = max(5, min(grace_minutes, 10080))
    batch_size = max(1, min(batch_size, 5000))
    max_affected = max(0, min(max_affected, batch_size))
    cutoff_dt = _utcnow() - timedelta(minutes=grace_minutes)
    SessionLocal = _get_db_session()
    query = text(
        """
        SELECT id, user_id, jti, created_at
        FROM user_sessions
        WHERE logged_out_at IS NULL
          AND created_at < :cutoff_dt
        ORDER BY created_at ASC
        LIMIT :batch_size
        """
    )
    recent_count_query = text(
        """
        SELECT COUNT(*) AS recent_count
        FROM user_sessions
        WHERE logged_out_at IS NULL
          AND created_at >= :cutoff_dt
        """
    )

    with SessionLocal() as db:
        rows = db.execute(
            query,
            {
                "cutoff_dt": cutoff_dt,
                "batch_size": batch_size,
            },
        ).mappings().all()
        recent_row = db.execute(recent_count_query, {"cutoff_dt": cutoff_dt}).mappings().first()

    skipped_recent_count = int((recent_row or {}).get("recent_count") or 0)
    if not rows:
        return (
            0,
            "No había sesiones antiguas pendientes de conciliación. "
            f"scanned=0 candidate=0 affected=0 skipped_recent={skipped_recent_count} grace_minutes={grace_minutes}.",
            "success",
        )

    redis = await get_redis()
    pipeline = redis.pipeline()
    for row in rows:
        pipeline.exists(f"session:{row['user_id']}:{row['jti']}")
    try:
        exists_results = await pipeline.execute()
    except Exception as exc:
        raise RuntimeError(f"Redis no respondió durante limpieza de sesiones; no se cerró ninguna sesión: {exc}") from exc

    stale_session_ids = [
        row["id"]
        for row, exists_flag in zip(rows, exists_results)
        if not bool(exists_flag)
    ]

    scanned_count = len(rows)
    stale_count = len(stale_session_ids)
    affected_limit_count = min(stale_count, max_affected)
    limited_session_ids = stale_session_ids[:affected_limit_count]
    skipped_grace_count = max(0, stale_count - affected_limit_count)

    if mode == "archive_only":
        return (
            0,
            "Se ejecutó limpieza de sesiones en modo observación. "
            f"scanned={scanned_count} candidate={stale_count} affected=0 "
            f"skipped_recent={skipped_recent_count} skipped_grace={skipped_grace_count} "
            f"grace_minutes={grace_minutes}.",
            "success",
        )

    if mode == "revoke_idle":
        return (
            0,
            "Modo revoke_idle no modificó sesiones: no existe soporte de last_seen/actividad confiable "
            "para aplicar revocación estricta segura. "
            f"scanned={scanned_count} candidate={stale_count} affected=0 "
            f"skipped_recent={skipped_recent_count} skipped_grace={skipped_grace_count} "
            f"grace_minutes={grace_minutes}.",
            "warning",
        )

    if not limited_session_ids:
        return (
            0,
            "No se encontraron sesiones antiguas elegibles para cierre técnico. "
            f"scanned={scanned_count} candidate={stale_count} affected=0 "
            f"skipped_recent={skipped_recent_count} skipped_grace={skipped_grace_count} "
            f"grace_minutes={grace_minutes}.",
            "success",
        )

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
        for session_id in limited_session_ids:
            db.execute(update_query, {"logged_out_at": now, "id": session_id})
        db.commit()

    return (
        affected_limit_count,
        "Se marcó logout técnico sobre sesiones antiguas sin presencia activa en Redis. "
        f"scanned={scanned_count} candidate={stale_count} affected={affected_limit_count} "
        f"skipped_recent={skipped_recent_count} skipped_grace={skipped_grace_count} "
        f"grace_minutes={grace_minutes} max_affected={max_affected}.",
        "success",
    )


def _parse_allowed_cleanup_subdirs() -> list[Path]:
    raw_value = str(getattr(settings, "MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS", "") or "")
    values = [item.strip().strip("/") for item in raw_value.split(",") if item.strip().strip("/")]
    allowed: list[Path] = []
    for value in values:
        candidate = Path(value)
        if candidate.is_absolute() or ".." in candidate.parts:
            logger.warning("Subdirectorio de limpieza ignorado por seguridad | value=%s", value)
            continue
        allowed.append(candidate)
    return allowed


def _resolve_cleanup_root() -> Path:
    raw_root = str(settings.TRACE_BASE_DIR or "").strip()
    if not raw_root:
        raise ValueError("TRACE_BASE_DIR está vacío. Limpieza cancelada por seguridad.")

    root = Path(raw_root)
    if not root.is_absolute():
        raise ValueError(f"TRACE_BASE_DIR debe ser absoluto. Valor recibido: {raw_root}")

    resolved = root.resolve(strict=False)
    resolved_text = str(resolved)
    dangerous_roots = set(_DANGEROUS_TEMP_ROOTS)
    if not bool(getattr(settings, "MAINTENANCE_TEMP_CLEANUP_ALLOW_TMP_ROOT", False)):
        dangerous_roots.add("/tmp")
    if resolved_text in dangerous_roots:
        raise ValueError(f"TRACE_BASE_DIR apunta a una ruta peligrosa: {resolved_text}")
    return resolved


def _is_relative_to(child: Path, parent: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


async def _handle_cleanup_temp_files(payload: dict[str, Any]) -> tuple[int, str, str]:
    max_age_days = int(payload.get("max_age_days") or 7)
    if max_age_days < 1 or max_age_days > 90:
        raise ValueError("max_age_days debe estar entre 1 y 90")

    root = _resolve_cleanup_root()
    if not root.exists():
        return 0, f"El directorio {root} no existe. No hubo archivos para limpiar.", "warning"
    if not root.is_dir():
        raise ValueError(f"TRACE_BASE_DIR no es un directorio: {root}")

    dry_run = bool(payload.get("dry_run", getattr(settings, "MAINTENANCE_TEMP_CLEANUP_DRY_RUN", False)))
    safety_grace_minutes = int(
        payload.get(
            "safety_grace_minutes",
            getattr(settings, "MAINTENANCE_TEMP_CLEANUP_SAFETY_GRACE_MINUTES", 30),
        )
        or 30
    )
    if safety_grace_minutes < 0:
        safety_grace_minutes = 0

    allowed_subdirs = _parse_allowed_cleanup_subdirs()
    allowed_roots: list[Path] = []
    warnings: list[str] = []
    missing_allowed_roots: list[str] = []
    for relative_subdir in allowed_subdirs:
        allowed_root = (root / relative_subdir).resolve(strict=False)
        if not _is_relative_to(allowed_root, root):
            warnings.append(f"Subdirectorio fuera de raíz ignorado: {relative_subdir}")
            continue
        if allowed_root.exists() and allowed_root.is_dir() and not allowed_root.is_symlink():
            allowed_roots.append(allowed_root)
        else:
            missing_allowed_roots.append(str(relative_subdir))

    if not allowed_roots:
        active_allowlist = ", ".join(str(item) for item in allowed_subdirs) or "(vacía)"
        missing_allowlist = ", ".join(missing_allowed_roots) or "(sin faltantes calculados)"
        message = (
            f"Limpieza cancelada en modo conservador: no existen subdirectorios permitidos bajo {root}. "
            f"TRACE_BASE_DIR={root}; allowlist_activa=[{active_allowlist}]; "
            f"allowlist_no_existente=[{missing_allowlist}]. No se eliminó ningún archivo. "
            "Configura MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS con subdirectorios reales y comienza con "
            "MAINTENANCE_TEMP_CLEANUP_DRY_RUN=true para validar el alcance."
        )
        logger.warning(message)
        return 0, message, "warning"

    now = time.time()
    retention_cutoff = now - (max_age_days * 86400)
    grace_cutoff = now - (safety_grace_minutes * 60)
    cutoff_timestamp = min(retention_cutoff, grace_cutoff)
    scanned_count = 0
    deleted_files = 0
    deleted_dirs = 0
    skipped_count = 0
    failed_count = 0

    for allowed_root in allowed_roots:
        for path in allowed_root.rglob("*"):
            scanned_count += 1
            try:
                if path.is_symlink():
                    skipped_count += 1
                    continue
                resolved_path = path.resolve(strict=False)
                if not _is_relative_to(resolved_path, root) or not any(
                    _is_relative_to(resolved_path, allowed_root) for allowed_root in allowed_roots
                ):
                    skipped_count += 1
                    warnings.append(f"Ruta fuera de allowlist omitida: {path}")
                    continue
                if not path.is_file():
                    continue
                stat = path.stat()
                if stat.st_mtime >= cutoff_timestamp:
                    skipped_count += 1
                    continue
                if not dry_run:
                    path.unlink()
                deleted_files += 1
            except FileNotFoundError:
                skipped_count += 1
            except OSError as exc:
                failed_count += 1
                warnings.append(f"No se pudo eliminar archivo {path}: {exc}")

    for allowed_root in sorted(allowed_roots, key=lambda item: len(item.parts), reverse=True):
        for dir_path in sorted((path for path in allowed_root.rglob("*") if path.is_dir()), reverse=True):
            try:
                if dir_path.is_symlink():
                    skipped_count += 1
                    continue
                resolved_dir = dir_path.resolve(strict=False)
                if not _is_relative_to(resolved_dir, allowed_root):
                    skipped_count += 1
                    continue
                if dry_run:
                    if not any(dir_path.iterdir()):
                        deleted_dirs += 1
                    continue
                dir_path.rmdir()
                deleted_dirs += 1
            except OSError:
                skipped_count += 1

    status = "warning" if failed_count or warnings else "success"
    summary = (
        f"Limpieza de temporales {'simulada' if dry_run else 'ejecutada'} | "
        f"scanned={scanned_count} deleted_files={deleted_files} deleted_dirs={deleted_dirs} "
        f"skipped={skipped_count} failed={failed_count} retention_days={max_age_days} "
        f"safety_grace_minutes={safety_grace_minutes} TRACE_BASE_DIR={root} "
        f"allowed_roots={len(allowed_roots)} allowed_roots_paths=[{', '.join(str(item) for item in allowed_roots)}]."
    )
    if warnings:
        summary = f"{summary} Advertencias: {'; '.join(warnings[:5])}"
    logger.info(summary)
    return deleted_files, summary, status


_ACTIONS: dict[str, Any] = {
    "cleanup_sessions": _handle_cleanup_sessions,
    "cleanup_temp_files": _handle_cleanup_temp_files,
}


async def handle_maintenance_job(job: JobEnvelope) -> None:
    payload = job.payload
    action = payload.get("action") or job.type
    correlation_id = payload.get("correlation_id")

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
        "Ejecutando acción de mantenimiento | action=%s job_id=%s correlation_id=%s type=%s attempt=%d",
        action, job.job_id, correlation_id, job.type, job.attempt,
    )

    if not await asyncio.to_thread(_mark_run_started, job, correlation_id):
        return

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
        result = await handler(payload)
        if len(result) == 3:
            affected_count, message, final_status = result
        else:
            affected_count, message = result
            final_status = "success"
    except Exception as exc:
        await asyncio.to_thread(
            _mark_run_finished,
            job,
            status="error",
            message=str(exc),
            affected_count=0,
            correlation_id=correlation_id,
            error_code=type(exc).__name__,
            error_detail=str(exc),
        )
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

    await asyncio.to_thread(
        _mark_run_finished,
        job,
        status=final_status,
        message=message,
        affected_count=affected_count,
        correlation_id=correlation_id,
    )

    if runtime_prefix:
        await asyncio.to_thread(_update_runtime_finished, runtime_prefix, final_status, message, affected_count)
        await _publish_runtime_event(
            status=final_status,
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
            status=final_status,
            message=message,
            trigger=trigger_source,
            job_id=job.job_id,
            affected_count=affected_count,
            requested_by_id=requested_by_id,
        )

    logger.info(
        "Acción de mantenimiento completada | action=%s job_id=%s correlation_id=%s affected_count=%d message=%s",
        action, job.job_id, correlation_id, affected_count, message,
    )

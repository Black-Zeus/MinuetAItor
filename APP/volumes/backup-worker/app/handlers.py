from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import shutil
import tarfile
from pathlib import Path

from core.backend_client import post_internal_json
from core.config import settings
from core.job import JobEnvelope
from core.redis_client import get_redis
from db import (
    clear_runtime_sessions,
    complete_operation_without_artifact,
    complete_operation,
    import_gzip_sql_file,
    insert_artifact,
    insert_audit_event,
    mark_artifact_purged,
    truncate_all_base_tables,
    update_operation_failed,
    update_operation_running,
    upsert_artifact,
    upsert_operation_completed_without_artifact,
    upsert_operation_failed,
)
from package_builder import (
    SYSTEM_MINIO_BUCKETS,
    build_database_backup_package,
    build_full_backup_package,
    build_objects_backup_package,
    restore_minio_bucket_archive,
    sha256_file,
)
from tools import missing_tool_names


logger = logging.getLogger("backup-worker.handlers")
BACKUP_EVENTS_CHANNEL = "events:system:backups"

GENERATE_JOB_TYPES = {"db_backup", "object_backup", "full_backup", "backup_purge"}
RESTORE_JOB_TYPES = {"restore_backup"}
PLANNED_LATER_JOB_TYPES: set[str] = set()
SUPPORTED_JOB_TYPES = GENERATE_JOB_TYPES | RESTORE_JOB_TYPES | PLANNED_LATER_JOB_TYPES

SCOPE_LABELS = {
    "database": "base de datos",
    "objects": "objetos MinIO",
    "full": "respaldo completo",
    "all": "respaldos",
}

ACTION_LABELS = {
    "db_backup": "Respaldo de base de datos",
    "object_backup": "Respaldo de objetos",
    "full_backup": "Respaldo completo",
    "backup_purge": "Limpieza de respaldos",
    "restore_backup": "Restauración de respaldo",
}


async def _publish_backup_event(
    *,
    status: str,
    scope: str,
    action: str,
    message: str,
    trigger: str,
    operation_id: str | None = None,
    job_id: str | None = None,
    artifact_id: str | None = None,
    actor_snapshot: dict | None = None,
    metadata: dict | None = None,
) -> None:
    try:
        redis = await get_redis()
        payload = {
            "event": "backup_update",
            "status": status,
            "scope": scope,
            "action": action,
            "message": message,
            "trigger": trigger,
            "operation_id": operation_id,
            "job_id": job_id,
            "artifact_id": artifact_id,
            "actor_user_id": (actor_snapshot or {}).get("user_id") or (actor_snapshot or {}).get("userId"),
            "metadata": metadata or {},
        }
        await redis.publish(BACKUP_EVENTS_CHANNEL, json.dumps(payload, ensure_ascii=False))
    except Exception as exc:
        logger.warning("No se pudo publicar evento SSE de respaldos | status=%s scope=%s err=%s", status, scope, exc)


def _actor_user_id(actor_snapshot: dict | None) -> str | None:
    if not isinstance(actor_snapshot, dict):
        return None
    value = actor_snapshot.get("user_id") or actor_snapshot.get("userId")
    return str(value).strip() or None


def _notification_title(*, status: str, action: str) -> str:
    label = ACTION_LABELS.get(action, "Tarea de respaldo")
    if status == "success":
        return f"{label} completado"
    if status == "error":
        return f"{label} fallido"
    if status == "cancelled":
        return f"{label} cancelado"
    return f"{label} actualizado"


def _notification_message(*, status: str, scope: str, trigger: str, message: str) -> str:
    scope_label = SCOPE_LABELS.get(scope, scope or "respaldo")
    trigger_label = "programada" if trigger == "scheduled" else "manual"

    if status == "success":
        prefix = f"La tarea {trigger_label} de {scope_label} finalizó correctamente."
    elif status == "error":
        prefix = f"La tarea {trigger_label} de {scope_label} terminó con error."
    elif status == "cancelled":
        prefix = f"La tarea {trigger_label} de {scope_label} fue cancelada."
    else:
        prefix = f"La tarea {trigger_label} de {scope_label} cambió de estado."

    clean_message = str(message or "").strip()
    return f"{prefix} {clean_message}".strip()


def _policy_value(policy: dict | None, snake_key: str, camel_key: str, default=None):
    if not isinstance(policy, dict):
        return default
    if snake_key in policy:
        return policy.get(snake_key)
    if camel_key in policy:
        return policy.get(camel_key)
    return default


def _format_size(value) -> str:
    try:
        size = float(value)
    except (TypeError, ValueError):
        return "—"
    units = ["B", "KB", "MB", "GB", "TB"]
    unit_index = 0
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    return f"{size:.1f} {units[unit_index]}" if unit_index else f"{int(size)} {units[unit_index]}"


def _backup_email_context(
    *,
    status: str,
    scope: str,
    action: str,
    message: str,
    trigger: str,
    operation_id: str | None,
    job_id: str | None,
    artifact_id: str | None,
    metadata: dict | None,
) -> dict:
    current_metadata = metadata or {}
    status_label = {
        "success": "Completado",
        "error": "Fallido",
        "cancelled": "Cancelado",
    }.get(status, status)
    trigger_label = "Automático" if trigger == "scheduled" else "Manual"
    title = _notification_title(status=status, action=action)
    return {
        "APP_NAME": "MinuetAItor",
        "BACKUP_SUBJECT": title,
        "BACKUP_TITLE": title,
        "BACKUP_MESSAGE": _notification_message(status=status, scope=scope, trigger=trigger, message=message),
        "BACKUP_STATUS_LABEL": status_label,
        "BACKUP_SCOPE_LABEL": SCOPE_LABELS.get(scope, scope or "respaldo"),
        "BACKUP_ACTION_LABEL": ACTION_LABELS.get(action, action or "Tarea de respaldo"),
        "BACKUP_TRIGGER_LABEL": trigger_label,
        "BACKUP_OPERATION_ID": operation_id or "—",
        "BACKUP_JOB_ID": job_id or "—",
        "BACKUP_ARTIFACT_ID": artifact_id or "—",
        "BACKUP_PACKAGE_NAME": current_metadata.get("name") or "—",
        "BACKUP_SIZE_LABEL": _format_size(current_metadata.get("sizeBytes")),
        "BACKUP_ERROR": current_metadata.get("error") or message or "Sin observaciones adicionales.",
    }


async def _create_backup_notification(
    *,
    status: str,
    scope: str,
    action: str,
    message: str,
    trigger: str,
    operation_id: str | None,
    job_id: str | None,
    artifact_id: str | None = None,
    actor_snapshot: dict | None = None,
    metadata: dict | None = None,
    policy: dict | None = None,
) -> None:
    if status not in {"success", "error", "cancelled"}:
        return

    notification_type = {
        "success": "system.backup.completed",
        "error": "system.backup.failed",
        "cancelled": "system.backup.cancelled",
    }[status]

    email = str(_policy_value(policy, "notify_recipient_email", "notifyRecipientEmail", "") or "").strip()
    email_enabled = bool(_policy_value(policy, "notify_by_email", "notifyByEmail", False)) and bool(email)
    title = _notification_title(status=status, action=action)
    message_text = _notification_message(
        status=status,
        scope=scope,
        trigger=trigger,
        message=message,
    )

    payload = {
        "notificationType": notification_type,
        "title": title,
        "message": message_text,
        "level": "success" if status == "success" else "error" if status == "error" else "warning",
        "tags": [
            "system",
            "backup",
            action,
            status,
            notification_type,
        ],
        "roleCodes": ["ADMIN"],
        "scopeType": "system_backup_operation",
        "scopeId": operation_id,
        "actionUrl": None,
        "actorUserId": _actor_user_id(actor_snapshot),
        "metadata": {
            "scope": scope,
            "action": action,
            "status": status,
            "trigger": trigger,
            "operationId": operation_id,
            "jobId": job_id,
            "artifactId": artifact_id,
            **(metadata or {}),
        },
        "emailEnabled": email_enabled,
        "emailTo": [email] if email_enabled else [],
        "emailTemplateId": "system_backup_result",
        "emailSubject": title,
        "emailContext": _backup_email_context(
            status=status,
            scope=scope,
            action=action,
            message=message,
            trigger=trigger,
            operation_id=operation_id,
            job_id=job_id,
            artifact_id=artifact_id,
            metadata=metadata,
        ),
    }

    try:
        await asyncio.to_thread(post_internal_json, "/internal/v1/notifications/ingest", payload)
    except Exception as exc:
        logger.warning(
            "No se pudo crear notificación persistida de respaldo | status=%s scope=%s operation_id=%s err=%s",
            status,
            scope,
            operation_id,
            exc,
        )


async def handle_backup_job(job: JobEnvelope) -> None:
    if job.type not in SUPPORTED_JOB_TYPES:
        raise ValueError(f"Tipo de job no soportado por backup-worker: {job.type!r}")

    missing_tools = missing_tool_names(job.type)
    if missing_tools:
        raise RuntimeError(
            f"Faltan herramientas requeridas para {job.type}: {', '.join(missing_tools)}"
        )

    backup_root = Path(settings.backup_storage_root)
    backup_root.mkdir(parents=True, exist_ok=True)

    if job.type in PLANNED_LATER_JOB_TYPES:
        logger.warning(
            "Job recibido para etapa posterior | job_id=%s type=%s payload_keys=%s",
            job.job_id,
            job.type,
            sorted(job.payload.keys()),
        )
        return

    if job.type == "db_backup":
        await _handle_database_backup(job, backup_root)
        return

    if job.type == "object_backup":
        await _handle_objects_backup(job, backup_root)
        return

    if job.type == "full_backup":
        await _handle_full_backup(job, backup_root)
        return

    if job.type == "backup_purge":
        await _handle_backup_purge(job, backup_root)
        return

    if job.type == "restore_backup":
        await _handle_restore_backup(job, backup_root)
        return

    logger.info(
        "Job de generacion validado | job_id=%s type=%s root=%s payload_keys=%s",
        job.job_id,
        job.type,
        backup_root,
        sorted(job.payload.keys()),
    )
    logger.info(
        "Generacion real pendiente | job_id=%s type=%s scope=%s",
        job.job_id,
        job.type,
        job.payload.get("scope") or job.type,
    )


async def _handle_database_backup(job: JobEnvelope, backup_root: Path) -> None:
    operation_id = str(job.payload.get("operation_id") or "").strip()
    if not operation_id:
        raise ValueError("El job db_backup no contiene operation_id.")

    scope = str(job.payload.get("scope") or "database")
    trigger_source = str(job.payload.get("trigger_source") or "manual")
    actor_snapshot = job.payload.get("requested_by_snapshot")
    policy = job.payload.get("policy") if isinstance(job.payload.get("policy"), dict) else {}

    logger.info(
        "Generando respaldo database | job_id=%s operation_id=%s root=%s",
        job.job_id,
        operation_id,
        backup_root,
    )
    update_operation_running(operation_id, "Generando respaldo de base de datos.")
    await _publish_backup_event(
        status="running",
        scope=scope,
        action="db_backup",
        message="Generando respaldo de base de datos.",
        trigger=trigger_source,
        operation_id=operation_id,
        job_id=job.job_id,
        actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
    )
    insert_audit_event(
        event_type="backup_database_started",
        operation_id=operation_id,
        artifact_id=None,
        actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
        details={"jobId": job.job_id, "scope": scope},
    )

    try:
        package = build_database_backup_package(
            job_id=job.job_id,
            operation_id=operation_id,
            scope=scope,
            trigger_source=trigger_source,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            db_schema_version=job.payload.get("db_schema_version"),
            app_version=job.payload.get("app_version"),
            policy=policy,
            backup_root=backup_root,
        )
        insert_artifact(
            artifact_id=package["artifactId"],
            scope=scope,
            name=package["name"],
            status="available",
            origin_type=trigger_source,
            storage_path=package["storagePath"],
            file_path=package["filePath"],
            size_bytes=int(package["sizeBytes"]),
            checksum_sha256=package["checksumSha256"],
            db_schema_version=job.payload.get("db_schema_version"),
            app_version=job.payload.get("app_version"),
            metadata=package["metadata"],
            manifest=package["manifest"],
            created_by=job.payload.get("requested_by_id"),
            created_by_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
        )
        complete_operation(
            operation_id=operation_id,
            artifact_id=package["artifactId"],
            message="Respaldo de base de datos generado correctamente.",
            result={
                "artifactId": package["artifactId"],
                "name": package["name"],
                "sizeBytes": package["sizeBytes"],
                "checksumSha256": package["checksumSha256"],
            },
        )
        insert_audit_event(
            event_type="backup_database_completed",
            operation_id=operation_id,
            artifact_id=package["artifactId"],
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            details={
                "jobId": job.job_id,
                "name": package["name"],
                "sizeBytes": package["sizeBytes"],
                "checksumSha256": package["checksumSha256"],
            },
        )
        await _publish_backup_event(
            status="success",
            scope=scope,
            action="db_backup",
            message="Respaldo de base de datos generado correctamente.",
            trigger=trigger_source,
            operation_id=operation_id,
            job_id=job.job_id,
            artifact_id=package["artifactId"],
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={"name": package["name"], "sizeBytes": package["sizeBytes"]},
        )
        await _create_backup_notification(
            status="success",
            scope=scope,
            action="db_backup",
            message="Respaldo de base de datos generado correctamente.",
            trigger=trigger_source,
            operation_id=operation_id,
            job_id=job.job_id,
            artifact_id=package["artifactId"],
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={"name": package["name"], "sizeBytes": package["sizeBytes"]},
            policy=policy,
        )
        logger.info(
            "Respaldo database generado | job_id=%s artifact_id=%s path=%s size=%s",
            job.job_id,
            package["artifactId"],
            package["filePath"],
            package["sizeBytes"],
        )
    except Exception as exc:
        update_operation_failed(
            operation_id,
            "Falló la generación del respaldo de base de datos.",
            str(exc),
        )
        insert_audit_event(
            event_type="backup_database_failed",
            operation_id=operation_id,
            artifact_id=None,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            details={"jobId": job.job_id, "error": str(exc)},
        )
        await _publish_backup_event(
            status="error",
            scope=scope,
            action="db_backup",
            message="Falló la generación del respaldo de base de datos.",
            trigger=trigger_source,
            operation_id=operation_id,
            job_id=job.job_id,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={"error": str(exc)},
        )
        if job.attempt >= settings.max_retries:
            await _create_backup_notification(
                status="error",
                scope=scope,
                action="db_backup",
                message="Falló la generación del respaldo de base de datos.",
                trigger=trigger_source,
                operation_id=operation_id,
                job_id=job.job_id,
                actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
                metadata={"error": str(exc)},
                policy=policy,
            )
        raise


async def _handle_objects_backup(job: JobEnvelope, backup_root: Path) -> None:
    operation_id = str(job.payload.get("operation_id") or "").strip()
    if not operation_id:
        raise ValueError("El job object_backup no contiene operation_id.")

    scope = str(job.payload.get("scope") or "objects")
    trigger_source = str(job.payload.get("trigger_source") or "manual")
    actor_snapshot = job.payload.get("requested_by_snapshot")
    policy = job.payload.get("policy") if isinstance(job.payload.get("policy"), dict) else {}

    logger.info(
        "Generando respaldo objects | job_id=%s operation_id=%s root=%s",
        job.job_id,
        operation_id,
        backup_root,
    )
    update_operation_running(operation_id, "Generando respaldo de objetos MinIO.")
    await _publish_backup_event(
        status="running",
        scope=scope,
        action="object_backup",
        message="Generando respaldo de objetos MinIO.",
        trigger=trigger_source,
        operation_id=operation_id,
        job_id=job.job_id,
        actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
    )
    insert_audit_event(
        event_type="backup_objects_started",
        operation_id=operation_id,
        artifact_id=None,
        actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
        details={"jobId": job.job_id, "scope": scope},
    )

    try:
        package = build_objects_backup_package(
            job_id=job.job_id,
            operation_id=operation_id,
            scope=scope,
            trigger_source=trigger_source,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            db_schema_version=job.payload.get("db_schema_version"),
            app_version=job.payload.get("app_version"),
            policy=policy,
            backup_root=backup_root,
        )
        insert_artifact(
            artifact_id=package["artifactId"],
            scope=scope,
            name=package["name"],
            status="available",
            origin_type=trigger_source,
            storage_path=package["storagePath"],
            file_path=package["filePath"],
            size_bytes=int(package["sizeBytes"]),
            checksum_sha256=package["checksumSha256"],
            db_schema_version=job.payload.get("db_schema_version"),
            app_version=job.payload.get("app_version"),
            metadata=package["metadata"],
            manifest=package["manifest"],
            created_by=job.payload.get("requested_by_id"),
            created_by_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
        )
        complete_operation(
            operation_id=operation_id,
            artifact_id=package["artifactId"],
            message="Respaldo de objetos MinIO generado correctamente.",
            result={
                "artifactId": package["artifactId"],
                "name": package["name"],
                "sizeBytes": package["sizeBytes"],
                "checksumSha256": package["checksumSha256"],
            },
        )
        insert_audit_event(
            event_type="backup_objects_completed",
            operation_id=operation_id,
            artifact_id=package["artifactId"],
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            details={
                "jobId": job.job_id,
                "name": package["name"],
                "sizeBytes": package["sizeBytes"],
                "checksumSha256": package["checksumSha256"],
            },
        )
        await _publish_backup_event(
            status="success",
            scope=scope,
            action="object_backup",
            message="Respaldo de objetos MinIO generado correctamente.",
            trigger=trigger_source,
            operation_id=operation_id,
            job_id=job.job_id,
            artifact_id=package["artifactId"],
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={"name": package["name"], "sizeBytes": package["sizeBytes"]},
        )
        await _create_backup_notification(
            status="success",
            scope=scope,
            action="object_backup",
            message="Respaldo de objetos MinIO generado correctamente.",
            trigger=trigger_source,
            operation_id=operation_id,
            job_id=job.job_id,
            artifact_id=package["artifactId"],
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={"name": package["name"], "sizeBytes": package["sizeBytes"]},
            policy=policy,
        )
        logger.info(
            "Respaldo objects generado | job_id=%s artifact_id=%s path=%s size=%s",
            job.job_id,
            package["artifactId"],
            package["filePath"],
            package["sizeBytes"],
        )
    except Exception as exc:
        update_operation_failed(
            operation_id,
            "Falló la generación del respaldo de objetos MinIO.",
            str(exc),
        )
        insert_audit_event(
            event_type="backup_objects_failed",
            operation_id=operation_id,
            artifact_id=None,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            details={"jobId": job.job_id, "error": str(exc)},
        )
        await _publish_backup_event(
            status="error",
            scope=scope,
            action="object_backup",
            message="Falló la generación del respaldo de objetos MinIO.",
            trigger=trigger_source,
            operation_id=operation_id,
            job_id=job.job_id,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={"error": str(exc)},
        )
        if job.attempt >= settings.max_retries:
            await _create_backup_notification(
                status="error",
                scope=scope,
                action="object_backup",
                message="Falló la generación del respaldo de objetos MinIO.",
                trigger=trigger_source,
                operation_id=operation_id,
                job_id=job.job_id,
                actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
                metadata={"error": str(exc)},
                policy=policy,
            )
        raise


async def _handle_full_backup(job: JobEnvelope, backup_root: Path) -> None:
    operation_id = str(job.payload.get("operation_id") or "").strip()
    if not operation_id:
        raise ValueError("El job full_backup no contiene operation_id.")

    scope = str(job.payload.get("scope") or "full")
    trigger_source = str(job.payload.get("trigger_source") or "manual")
    actor_snapshot = job.payload.get("requested_by_snapshot")
    policy = job.payload.get("policy") if isinstance(job.payload.get("policy"), dict) else {}

    logger.info(
        "Generando respaldo full | job_id=%s operation_id=%s root=%s",
        job.job_id,
        operation_id,
        backup_root,
    )
    update_operation_running(operation_id, "Generando respaldo completo de base de datos y objetos MinIO.")
    await _publish_backup_event(
        status="running",
        scope=scope,
        action="full_backup",
        message="Generando respaldo completo de base de datos y objetos MinIO.",
        trigger=trigger_source,
        operation_id=operation_id,
        job_id=job.job_id,
        actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
    )
    insert_audit_event(
        event_type="backup_full_started",
        operation_id=operation_id,
        artifact_id=None,
        actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
        details={"jobId": job.job_id, "scope": scope},
    )

    try:
        package = build_full_backup_package(
            job_id=job.job_id,
            operation_id=operation_id,
            scope=scope,
            trigger_source=trigger_source,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            db_schema_version=job.payload.get("db_schema_version"),
            app_version=job.payload.get("app_version"),
            policy=policy,
            backup_root=backup_root,
        )
        insert_artifact(
            artifact_id=package["artifactId"],
            scope=scope,
            name=package["name"],
            status="available",
            origin_type=trigger_source,
            storage_path=package["storagePath"],
            file_path=package["filePath"],
            size_bytes=int(package["sizeBytes"]),
            checksum_sha256=package["checksumSha256"],
            db_schema_version=job.payload.get("db_schema_version"),
            app_version=job.payload.get("app_version"),
            metadata=package["metadata"],
            manifest=package["manifest"],
            created_by=job.payload.get("requested_by_id"),
            created_by_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
        )
        complete_operation(
            operation_id=operation_id,
            artifact_id=package["artifactId"],
            message="Respaldo completo generado correctamente.",
            result={
                "artifactId": package["artifactId"],
                "name": package["name"],
                "sizeBytes": package["sizeBytes"],
                "checksumSha256": package["checksumSha256"],
            },
        )
        insert_audit_event(
            event_type="backup_full_completed",
            operation_id=operation_id,
            artifact_id=package["artifactId"],
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            details={
                "jobId": job.job_id,
                "name": package["name"],
                "sizeBytes": package["sizeBytes"],
                "checksumSha256": package["checksumSha256"],
            },
        )
        await _publish_backup_event(
            status="success",
            scope=scope,
            action="full_backup",
            message="Respaldo completo generado correctamente.",
            trigger=trigger_source,
            operation_id=operation_id,
            job_id=job.job_id,
            artifact_id=package["artifactId"],
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={"name": package["name"], "sizeBytes": package["sizeBytes"]},
        )
        await _create_backup_notification(
            status="success",
            scope=scope,
            action="full_backup",
            message="Respaldo completo generado correctamente.",
            trigger=trigger_source,
            operation_id=operation_id,
            job_id=job.job_id,
            artifact_id=package["artifactId"],
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={"name": package["name"], "sizeBytes": package["sizeBytes"]},
            policy=policy,
        )
        logger.info(
            "Respaldo full generado | job_id=%s artifact_id=%s path=%s size=%s",
            job.job_id,
            package["artifactId"],
            package["filePath"],
            package["sizeBytes"],
        )
    except Exception as exc:
        update_operation_failed(
            operation_id,
            "Falló la generación del respaldo completo.",
            str(exc),
        )
        insert_audit_event(
            event_type="backup_full_failed",
            operation_id=operation_id,
            artifact_id=None,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            details={"jobId": job.job_id, "error": str(exc)},
        )
        await _publish_backup_event(
            status="error",
            scope=scope,
            action="full_backup",
            message="Falló la generación del respaldo completo.",
            trigger=trigger_source,
            operation_id=operation_id,
            job_id=job.job_id,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={"error": str(exc)},
        )
        if job.attempt >= settings.max_retries:
            await _create_backup_notification(
                status="error",
                scope=scope,
                action="full_backup",
                message="Falló la generación del respaldo completo.",
                trigger=trigger_source,
                operation_id=operation_id,
                job_id=job.job_id,
                actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
                metadata={"error": str(exc)},
                policy=policy,
            )
        raise


def _safe_backup_path(backup_root: Path, raw_path: str | None) -> Path | None:
    if not raw_path:
        return None
    root = backup_root.resolve()
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = root / candidate
    resolved = candidate.resolve(strict=False)
    if resolved == root or root not in resolved.parents:
        raise ValueError(f"Ruta fuera del directorio de respaldos: {raw_path}")
    return resolved


def _safe_restore_member_path(restore_root: Path, raw_path: str | None) -> Path:
    if not raw_path:
        raise ValueError("Ruta interna de restore vacía.")
    root = restore_root.resolve(strict=False)
    candidate = Path(str(raw_path))
    if candidate.is_absolute() or ".." in candidate.parts:
        raise ValueError(f"Ruta insegura en manifest de restore: {raw_path}")
    resolved = (root / candidate).resolve(strict=False)
    if resolved == root or root not in resolved.parents:
        raise ValueError(f"Ruta fuera del paquete de restore: {raw_path}")
    return resolved


def _sha256_tar_member(archive: tarfile.TarFile, member_name: str) -> str:
    member = archive.getmember(member_name)
    extracted = archive.extractfile(member)
    if extracted is None:
        raise ValueError(f"No se pudo leer miembro interno: {member_name}")
    digest = hashlib.sha256()
    for chunk in iter(lambda: extracted.read(1024 * 1024), b""):
        digest.update(chunk)
    return digest.hexdigest()


def _parse_checksums(value: str) -> dict[str, str]:
    checksums: dict[str, str] = {}
    for line in str(value or "").splitlines():
        clean = line.strip()
        if not clean:
            continue
        parts = clean.split(None, 1)
        if len(parts) == 2:
            checksums[parts[1].strip()] = parts[0].strip()
    return checksums


def _read_tar_json(archive: tarfile.TarFile, member_name: str) -> dict:
    extracted = archive.extractfile(archive.getmember(member_name))
    if extracted is None:
        raise ValueError(f"No se pudo leer {member_name}.")
    data = json.loads(extracted.read().decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{member_name} no contiene un objeto JSON.")
    return data


def _read_tar_text(archive: tarfile.TarFile, member_name: str) -> str:
    extracted = archive.extractfile(archive.getmember(member_name))
    if extracted is None:
        raise ValueError(f"No se pudo leer {member_name}.")
    return extracted.read().decode("utf-8")


def _validate_restore_package(package_path: Path, expected_checksum: str | None) -> tuple[dict, dict, dict[str, str]]:
    if not package_path.is_file():
        raise FileNotFoundError(f"No existe el paquete de respaldo: {package_path}")
    if expected_checksum:
        actual_package_checksum = sha256_file(package_path)
        if actual_package_checksum != expected_checksum:
            raise ValueError("El SHA-256 del paquete no coincide con el catálogo.")

    with tarfile.open(package_path, "r:gz") as archive:
        member_names = set(archive.getnames())
        for required_member in ("metadata.json", "manifest.json", "checksums.sha256"):
            if required_member not in member_names:
                raise ValueError(f"Miembro requerido faltante: {required_member}")

        metadata = _read_tar_json(archive, "metadata.json")
        manifest = _read_tar_json(archive, "manifest.json")
        checksums = _parse_checksums(_read_tar_text(archive, "checksums.sha256"))
        if not checksums:
            raise ValueError("checksums.sha256 no contiene entradas válidas.")

        for relative_path, expected_sha in checksums.items():
            if relative_path not in member_names:
                raise ValueError(f"Archivo interno faltante: {relative_path}")
            actual_sha = _sha256_tar_member(archive, relative_path)
            if actual_sha != expected_sha:
                raise ValueError(f"Checksum interno no coincide: {relative_path}")
    return metadata, manifest, checksums


def _safe_extract_package(package_path: Path, destination: Path) -> None:
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    with tarfile.open(package_path, "r:gz") as archive:
        for member in archive.getmembers():
            target = (destination / member.name).resolve(strict=False)
            if target != root and root not in target.parents:
                raise ValueError(f"Ruta insegura dentro del paquete: {member.name}")
            if member.issym() or member.islnk() or member.isdev():
                raise ValueError(f"Tipo de miembro no permitido dentro del paquete: {member.name}")
        archive.extractall(destination)


def _write_maintenance_marker(job: JobEnvelope, *, scope: str, artifact_id: str, actor_snapshot: dict | None) -> None:
    marker_path = Path(settings.maintenance_state_file)
    marker_path.parent.mkdir(parents=True, exist_ok=True)
    marker_path.write_text(
        json.dumps(
            {
                "mode": "restore",
                "operationId": job.payload.get("operation_id"),
                "jobId": job.job_id,
                "artifactId": artifact_id,
                "scope": scope,
                "status": "running",
                "actor": actor_snapshot or None,
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )


def _clear_maintenance_marker() -> None:
    Path(settings.maintenance_state_file).unlink(missing_ok=True)


def _build_pre_restore_backup(job: JobEnvelope, backup_root: Path, *, scope: str, actor_snapshot: dict | None) -> dict:
    common = {
        "job_id": f"{job.job_id}-pre-restore",
        "operation_id": str(job.payload.get("operation_id")),
        "scope": scope,
        "trigger_source": "pre_restore",
        "actor_snapshot": actor_snapshot,
        "db_schema_version": job.payload.get("db_schema_version"),
        "app_version": job.payload.get("app_version"),
        "policy": {"reason": "pre_restore_snapshot", "restoreArtifactId": job.payload.get("artifact_id")},
        "backup_root": backup_root,
    }
    if scope == "database":
        return build_database_backup_package(**common)
    if scope == "objects":
        return build_objects_backup_package(**common)
    return build_full_backup_package(**common)


def _upsert_package_artifact_from_payload(job: JobEnvelope, metadata: dict, manifest: dict, package_path: Path) -> None:
    actor_snapshot = metadata.get("actor") if isinstance(metadata.get("actor"), dict) else None
    upsert_artifact(
        artifact_id=str(metadata.get("artifactId") or job.payload.get("artifact_id")),
        scope=str(metadata.get("scope") or job.payload.get("scope")),
        name=str(job.payload.get("artifact_name") or package_path.name),
        status="available",
        origin_type=str(metadata.get("triggerSource") or "manual"),
        storage_path=str(job.payload.get("storage_path") or package_path),
        file_path=str(job.payload.get("file_path") or package_path),
        size_bytes=int(job.payload.get("artifact_size_bytes") or package_path.stat().st_size),
        checksum_sha256=str(job.payload.get("artifact_checksum_sha256") or sha256_file(package_path)),
        db_schema_version=metadata.get("dbSchemaVersion"),
        app_version=metadata.get("appVersion"),
        metadata=metadata,
        manifest=manifest,
        created_by=(actor_snapshot or {}).get("user_id") or (actor_snapshot or {}).get("userId"),
        created_by_snapshot=actor_snapshot,
    )


async def _flush_redis_after_restore() -> None:
    redis = await get_redis()
    await redis.flushdb()


async def _publish_restore_phase(
    job: JobEnvelope,
    *,
    scope: str,
    artifact_id: str,
    actor_snapshot: dict | None,
    phase: str,
    message: str,
    status: str = "running",
    metadata: dict | None = None,
) -> None:
    await _publish_backup_event(
        status=status,
        scope=scope,
        action="restore_backup",
        message=message,
        trigger=str(job.payload.get("trigger_source") or "manual_restore"),
        operation_id=str(job.payload.get("operation_id") or ""),
        job_id=job.job_id,
        artifact_id=artifact_id,
        actor_snapshot=actor_snapshot,
        metadata={"phase": phase, **(metadata or {})},
    )


async def _handle_restore_backup(job: JobEnvelope, backup_root: Path) -> None:
    operation_id = str(job.payload.get("operation_id") or "").strip()
    artifact_id = str(job.payload.get("artifact_id") or "").strip()
    if not operation_id:
        raise ValueError("El job restore_backup no contiene operation_id.")
    if not artifact_id:
        raise ValueError("El job restore_backup no contiene artifact_id.")

    scope = str(job.payload.get("scope") or "full")
    trigger_source = str(job.payload.get("trigger_source") or "manual_restore")
    actor_snapshot = job.payload.get("requested_by_snapshot")
    actor = actor_snapshot if isinstance(actor_snapshot, dict) else None
    package_path = _safe_backup_path(backup_root, job.payload.get("package_path") or job.payload.get("file_path"))
    if package_path is None:
        raise ValueError("El job restore_backup no contiene package_path.")

    logger.warning(
        "Iniciando restauración segura | job_id=%s operation_id=%s artifact_id=%s scope=%s",
        job.job_id,
        operation_id,
        artifact_id,
        scope,
    )
    update_operation_running(operation_id, "Validando paquete y preparando restauración segura.")
    _write_maintenance_marker(job, scope=scope, artifact_id=artifact_id, actor_snapshot=actor)
    await _publish_restore_phase(
        job,
        scope=scope,
        artifact_id=artifact_id,
        actor_snapshot=actor,
        phase="validating_package",
        message="Validando paquete y preparando restauración segura.",
    )
    insert_audit_event(
        event_type="backup_restore_started",
        operation_id=operation_id,
        artifact_id=artifact_id,
        actor_snapshot=actor,
        details={"jobId": job.job_id, "scope": scope, "packagePath": str(package_path)},
    )

    pre_restore_package: dict | None = None
    result: dict = {}
    try:
        metadata, manifest, checksums = _validate_restore_package(
            package_path,
            str(job.payload.get("artifact_checksum_sha256") or "").strip() or None,
        )
        package_scope = str(metadata.get("scope") or scope)
        if package_scope != scope:
            raise ValueError("El scope del paquete no coincide con el job de restauración.")

        await _publish_restore_phase(
            job,
            scope=scope,
            artifact_id=artifact_id,
            actor_snapshot=actor,
            phase="creating_pre_restore_backup",
            message="Generando respaldo previo a la restauración.",
            metadata={"validatedFileCount": len(checksums)},
        )
        pre_restore_package = _build_pre_restore_backup(job, backup_root, scope=scope, actor_snapshot=actor)
        upsert_artifact(
            artifact_id=pre_restore_package["artifactId"],
            scope=scope,
            name=pre_restore_package["name"],
            status="available",
            origin_type="pre_restore",
            storage_path=pre_restore_package["storagePath"],
            file_path=pre_restore_package["filePath"],
            size_bytes=int(pre_restore_package["sizeBytes"]),
            checksum_sha256=pre_restore_package["checksumSha256"],
            db_schema_version=job.payload.get("db_schema_version"),
            app_version=job.payload.get("app_version"),
            metadata=pre_restore_package["metadata"],
            manifest=pre_restore_package["manifest"],
            created_by=job.payload.get("requested_by_id"),
            created_by_snapshot=actor,
        )
        insert_audit_event(
            event_type="backup_pre_restore_completed",
            operation_id=operation_id,
            artifact_id=pre_restore_package["artifactId"],
            actor_snapshot=actor,
            details={
                "jobId": job.job_id,
                "name": pre_restore_package["name"],
                "sizeBytes": pre_restore_package["sizeBytes"],
                "checksumSha256": pre_restore_package["checksumSha256"],
            },
        )

        restore_root = backup_root / ".work" / job.job_id / "restore"
        _safe_extract_package(package_path, restore_root)
        sections = manifest.get("sections") if isinstance(manifest.get("sections"), dict) else {}
        database_section = sections.get("database") if isinstance(sections.get("database"), dict) else {}
        objects_section = sections.get("objects") if isinstance(sections.get("objects"), dict) else {}

        restored_tables: list[str] = []
        restored_buckets: list[dict] = []
        if bool(database_section.get("enabled")):
            await _publish_restore_phase(
                job,
                scope=scope,
                artifact_id=artifact_id,
                actor_snapshot=actor,
                phase="restoring_database",
                message="Limpiando tablas e importando datos MariaDB.",
            )
            db_path = _safe_restore_member_path(
                restore_root,
                str(database_section.get("path") or "mariadb/data.sql.gz"),
            )
            if not db_path.is_file():
                raise FileNotFoundError(f"No existe el dump MariaDB esperado: {db_path}")
            restored_tables = truncate_all_base_tables()
            import_gzip_sql_file(db_path)

        if bool(objects_section.get("enabled")):
            await _publish_restore_phase(
                job,
                scope=scope,
                artifact_id=artifact_id,
                actor_snapshot=actor,
                phase="restoring_objects",
                message="Limpiando buckets MinIO y restaurando objetos.",
            )
            buckets = objects_section.get("buckets") if isinstance(objects_section.get("buckets"), list) else []
            for bucket_entry in buckets:
                if not isinstance(bucket_entry, dict):
                    continue
                bucket_name = str(bucket_entry.get("name") or "").strip()
                bucket_path = str(bucket_entry.get("path") or "").strip()
                if not bucket_name or not bucket_path:
                    continue
                if bucket_name not in SYSTEM_MINIO_BUCKETS:
                    raise ValueError(f"Bucket no permitido en manifest de restore: {bucket_name}")
                bucket_archive_path = _safe_restore_member_path(restore_root, bucket_path)
                restored_buckets.append(
                    restore_minio_bucket_archive(bucket_name, bucket_archive_path, restore_root)
                )

        await _publish_restore_phase(
            job,
            scope=scope,
            artifact_id=artifact_id,
            actor_snapshot=actor,
            phase="registering_results",
            message="Registrando resultado de restauración y auditoría.",
        )
        _upsert_package_artifact_from_payload(job, metadata, manifest, package_path)
        if pre_restore_package:
            upsert_artifact(
                artifact_id=pre_restore_package["artifactId"],
                scope=scope,
                name=pre_restore_package["name"],
                status="available",
                origin_type="pre_restore",
                storage_path=pre_restore_package["storagePath"],
                file_path=pre_restore_package["filePath"],
                size_bytes=int(pre_restore_package["sizeBytes"]),
                checksum_sha256=pre_restore_package["checksumSha256"],
                db_schema_version=job.payload.get("db_schema_version"),
                app_version=job.payload.get("app_version"),
                metadata=pre_restore_package["metadata"],
                manifest=pre_restore_package["manifest"],
                created_by=job.payload.get("requested_by_id"),
                created_by_snapshot=actor,
            )

        await _publish_restore_phase(
            job,
            scope=scope,
            artifact_id=artifact_id,
            actor_snapshot=actor,
            phase="clearing_runtime",
            message="Limpiando sesiones runtime y preparando cierre de Redis.",
        )
        runtime_result = clear_runtime_sessions()
        result = {
            "artifactId": artifact_id,
            "scope": scope,
            "packagePath": str(package_path),
            "preRestoreArtifactId": pre_restore_package["artifactId"] if pre_restore_package else None,
            "validatedFileCount": len(checksums),
            "databaseRestored": bool(database_section.get("enabled")),
            "truncatedTableCount": len(restored_tables),
            "objectsRestored": bool(objects_section.get("enabled")),
            "restoredBuckets": restored_buckets,
            "runtime": runtime_result,
            "redisFlush": "pending_after_success_event",
        }
        upsert_operation_completed_without_artifact(
            operation_id=operation_id,
            operation_type="restore_backup",
            scope=scope,
            trigger_source=trigger_source,
            job_id=job.job_id,
            artifact_id=artifact_id,
            requested_by=job.payload.get("requested_by_id"),
            requested_by_snapshot=actor,
            payload=job.payload,
            message="Restauración completada correctamente.",
            result=result,
        )
        insert_audit_event(
            event_type="backup_restore_completed",
            operation_id=operation_id,
            artifact_id=artifact_id,
            actor_snapshot=actor,
            details={**result, "jobId": job.job_id},
        )
        await _publish_restore_phase(
            job,
            status="success",
            scope=scope,
            artifact_id=artifact_id,
            actor_snapshot=actor,
            phase="completed",
            message="Restauración completada correctamente. Las sesiones fueron limpiadas.",
            metadata=result,
        )
        await _create_backup_notification(
            status="success",
            scope=scope,
            action="restore_backup",
            message="Restauración completada correctamente. Las sesiones fueron limpiadas.",
            trigger=trigger_source,
            operation_id=operation_id,
            job_id=job.job_id,
            artifact_id=artifact_id,
            actor_snapshot=actor,
            metadata=result,
        )
        await asyncio.sleep(0.5)
        await _flush_redis_after_restore()
        logger.warning(
            "Restauración completada | job_id=%s operation_id=%s artifact_id=%s scope=%s",
            job.job_id,
            operation_id,
            artifact_id,
            scope,
        )
    except Exception as exc:
        try:
            upsert_operation_failed(
                operation_id=operation_id,
                operation_type="restore_backup",
                scope=scope,
                trigger_source=trigger_source,
                job_id=job.job_id,
                artifact_id=artifact_id,
                requested_by=job.payload.get("requested_by_id"),
                requested_by_snapshot=actor,
                payload=job.payload,
                message="Falló la restauración segura.",
                error_message=str(exc),
            )
            insert_audit_event(
                event_type="backup_restore_failed",
                operation_id=operation_id,
                artifact_id=artifact_id,
                actor_snapshot=actor,
                details={"jobId": job.job_id, "error": str(exc), "partialResult": result},
            )
        except Exception as audit_exc:
            logger.warning("No se pudo registrar fallo de restore | err=%s", audit_exc)
        await _publish_restore_phase(
            job,
            status="error",
            scope=scope,
            artifact_id=artifact_id,
            actor_snapshot=actor,
            phase="failed",
            message="Falló la restauración segura.",
            metadata={"error": str(exc)},
        )
        if job.attempt >= settings.max_retries:
            await _create_backup_notification(
                status="error",
                scope=scope,
                action="restore_backup",
                message="Falló la restauración segura.",
                trigger=trigger_source,
                operation_id=operation_id,
                job_id=job.job_id,
                artifact_id=artifact_id,
                actor_snapshot=actor,
                metadata={"error": str(exc)},
            )
        raise
    finally:
        _clear_maintenance_marker()
        shutil.rmtree(backup_root / ".work" / job.job_id, ignore_errors=True)


async def _handle_backup_purge(job: JobEnvelope, backup_root: Path) -> None:
    operation_id = str(job.payload.get("operation_id") or "").strip()
    if not operation_id:
        raise ValueError("El job backup_purge no contiene operation_id.")

    actor_snapshot = job.payload.get("requested_by_snapshot")
    candidates = job.payload.get("candidates") if isinstance(job.payload.get("candidates"), list) else []
    purge_mode = str(job.payload.get("purge_mode") or "retention")
    is_manual_artifact = purge_mode == "manual_artifact"

    logger.info(
        "Ejecutando purge de respaldos | job_id=%s operation_id=%s mode=%s candidates=%d",
        job.job_id,
        operation_id,
        purge_mode,
        len(candidates),
    )
    update_operation_running(
        operation_id,
        "Eliminando respaldo seleccionado." if is_manual_artifact else "Limpiando respaldos vencidos.",
    )
    await _publish_backup_event(
        status="running",
        scope=str(job.payload.get("scope") or "all"),
        action="backup_purge",
        message="Eliminando respaldo seleccionado." if is_manual_artifact else "Limpiando respaldos vencidos.",
        trigger=str(job.payload.get("trigger_source") or "manual"),
        operation_id=operation_id,
        job_id=job.job_id,
        actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
        metadata={"purgeMode": purge_mode, "candidateCount": len(candidates)},
    )
    insert_audit_event(
        event_type="backup_purge_started",
        operation_id=operation_id,
        artifact_id=None,
        actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
        details={
            "jobId": job.job_id,
            "purgeMode": purge_mode,
            "candidateCount": len(candidates),
            "retentionDays": job.payload.get("retention_days"),
            "cutoffAt": job.payload.get("cutoff_at"),
        },
    )

    purged: list[dict] = []
    missing_files: list[dict] = []
    errors: list[dict] = []

    try:
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            artifact_id = str(candidate.get("id") or "").strip()
            if not artifact_id:
                continue

            try:
                file_path = _safe_backup_path(backup_root, candidate.get("filePath") or candidate.get("file_path"))
                file_deleted = False
                file_missing = False
                if file_path:
                    if file_path.exists():
                        file_path.unlink()
                        file_deleted = True
                    else:
                        file_missing = True
                        missing_files.append({"id": artifact_id, "filePath": str(file_path)})

                mark_artifact_purged(
                    artifact_id=artifact_id,
                    deleted_by=job.payload.get("requested_by_id"),
                    deleted_by_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
                )
                purged.append(
                    {
                        "id": artifact_id,
                        "name": candidate.get("name"),
                        "scope": candidate.get("scope"),
                        "fileDeleted": file_deleted,
                        "fileMissing": file_missing,
                        "sizeBytes": int(candidate.get("sizeBytes") or candidate.get("size_bytes") or 0),
                    }
                )
            except Exception as exc:
                errors.append({"id": artifact_id, "name": candidate.get("name"), "error": str(exc)})

        result = {
            "candidateCount": len(candidates),
            "purgedCount": len(purged),
            "missingFileCount": len(missing_files),
            "errorCount": len(errors),
            "purged": purged,
            "missingFiles": missing_files,
            "errors": errors,
        }
        if errors:
            raise RuntimeError(f"Purge finalizó con {len(errors)} errores.")

        complete_operation_without_artifact(
            operation_id=operation_id,
            message=(
                f"Eliminación manual de respaldo completada ({len(purged)} purgados)."
                if is_manual_artifact
                else f"Limpieza de respaldos completada ({len(purged)} purgados)."
            ),
            result=result,
        )
        insert_audit_event(
            event_type="backup_purge_completed",
            operation_id=operation_id,
            artifact_id=None,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            details={**result, "jobId": job.job_id},
        )
        await _publish_backup_event(
            status="success",
            scope=str(job.payload.get("scope") or "all"),
            action="backup_purge",
            message=(
                f"Eliminación manual de respaldo completada ({len(purged)} purgados)."
                if is_manual_artifact
                else f"Limpieza de respaldos completada ({len(purged)} purgados)."
            ),
            trigger=str(job.payload.get("trigger_source") or "manual"),
            operation_id=operation_id,
            job_id=job.job_id,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={**result, "purgeMode": purge_mode},
        )
        await _create_backup_notification(
            status="success",
            scope=str(job.payload.get("scope") or "all"),
            action="backup_purge",
            message=(
                f"Eliminación manual de respaldo completada ({len(purged)} purgados)."
                if is_manual_artifact
                else f"Limpieza de respaldos completada ({len(purged)} purgados)."
            ),
            trigger=str(job.payload.get("trigger_source") or "manual"),
            operation_id=operation_id,
            job_id=job.job_id,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={**result, "purgeMode": purge_mode},
        )
        logger.info(
            "Purge de respaldos completado | job_id=%s operation_id=%s purged=%d missing=%d",
            job.job_id,
            operation_id,
            len(purged),
            len(missing_files),
        )
    except Exception as exc:
        update_operation_failed(
            operation_id,
            "Falló la limpieza de respaldos.",
            str(exc),
        )
        insert_audit_event(
            event_type="backup_purge_failed",
            operation_id=operation_id,
            artifact_id=None,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            details={
                "jobId": job.job_id,
                "error": str(exc),
                "purgedCount": len(purged),
                "missingFileCount": len(missing_files),
                "errors": errors,
            },
        )
        await _publish_backup_event(
            status="error",
            scope=str(job.payload.get("scope") or "all"),
            action="backup_purge",
            message="Falló la eliminación manual del respaldo." if is_manual_artifact else "Falló la limpieza de respaldos.",
            trigger=str(job.payload.get("trigger_source") or "manual"),
            operation_id=operation_id,
            job_id=job.job_id,
            actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
            metadata={"error": str(exc), "purgeMode": purge_mode},
        )
        if job.attempt >= settings.max_retries:
            await _create_backup_notification(
                status="error",
                scope=str(job.payload.get("scope") or "all"),
                action="backup_purge",
                message="Falló la eliminación manual del respaldo." if is_manual_artifact else "Falló la limpieza de respaldos.",
                trigger=str(job.payload.get("trigger_source") or "manual"),
                operation_id=operation_id,
                job_id=job.job_id,
                actor_snapshot=actor_snapshot if isinstance(actor_snapshot, dict) else None,
                metadata={"error": str(exc), "purgeMode": purge_mode},
            )
        raise

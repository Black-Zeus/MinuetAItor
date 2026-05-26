from __future__ import annotations

import hashlib
import json
import shutil
import tarfile
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from core.config import settings
from core.datetime_utils import assume_utc, utc_now, utc_now_db
from core.exceptions import BadRequestException, NotFoundException
from db.redis import get_redis
from models.system_backups import (
    SystemBackupArtifact,
    SystemBackupAuditEvent,
    SystemBackupOperation,
    SystemBackupSetting,
    SystemOperationState,
)
from models.user import User
from schemas.auth import UserSession
from schemas.system_backups import (
    BACKUP_SCOPES,
    SystemBackupsConfigRequest,
    validate_cron_expression,
)
from services.system_backup_events_service import publish_backup_event

BACKUP_QUEUE = "queue:backups"
BACKUP_DLQ_QUEUE = "queue:backups:dlq"
SYSTEM_BACKUP_SETTINGS_SINGLETON_ID = 1
SYSTEM_OPERATION_STATE_SINGLETON_ID = 1
BACKUP_STORAGE_ROOT = "/app/remote_data/backups"
BACKUP_PACKAGE_GLOB = "backup-*.tar.gz"
BACKUP_IMPORT_MAX_BYTES = 5 * 1024 * 1024 * 1024
BACKUP_IMPORT_MAX_MEMBERS = 50_000
BACKUP_IMPORT_MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024 * 1024
SCHEDULER_TIMEZONE = "America/Santiago"
BACKUP_TICK_LOCK_KEY = "lock:system:backups:tick"
BACKUP_TICK_LOCK_TTL_SEC = 90
BACKUP_SCHEDULE_SLOT_TTL_SEC = 60 * 60 * 24 * 8
SCHEMA_SQL_DIR_CANDIDATES = (
    Path("/app/data/settings/mariadb/init"),
    Path.cwd() / "APP/data/settings/mariadb/init",
    Path.cwd().parent / "APP/data/settings/mariadb/init",
)

DEFAULT_POLICIES = {
    "database": {
        "enabled": True,
        "cron": "0 2 * * *",
        "destination": "backend_shared",
        "path_prefix": "/app/remote_data/backups/database",
        "file_format": "sql_gzip",
        "verification_mode": "manifest",
        "notify_by_email": True,
        "notify_recipient_name": "Operaciones DB",
        "notify_recipient_email": "dba@minuet.local",
    },
    "objects": {
        "enabled": False,
        "cron": "30 2 * * *",
        "destination": "backend_shared",
        "path_prefix": "/app/remote_data/backups/objects",
        "file_format": "tar_gzip",
        "verification_mode": "inventory",
        "notify_by_email": False,
        "notify_recipient_name": "",
        "notify_recipient_email": "",
    },
    "full": {
        "enabled": True,
        "cron": "0 4 * * 0",
        "destination": "backend_shared",
        "path_prefix": "/app/remote_data/backups/full",
        "file_format": "tar_gzip",
        "verification_mode": "checksum",
        "notify_by_email": True,
        "notify_recipient_name": "Respaldo general",
        "notify_recipient_email": "backup@minuet.local",
    },
}

EXPECTED_TABLES = {
    "system_operation_state",
    "system_backup_settings",
    "system_backup_artifacts",
    "system_backup_operations",
    "system_backup_audit_events",
    "system_deferred_tasks",
}


def _iso(value) -> str | None:
    normalized = assume_utc(value)
    return normalized.isoformat() if normalized else None


def _json_loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _read_backup_package_json(path: Path, member_name: str) -> dict | None:
    try:
        with tarfile.open(path, "r:gz") as archive:
            member = archive.getmember(member_name)
            extracted = archive.extractfile(member)
            if extracted is None:
                return None
            data = json.loads(extracted.read().decode("utf-8"))
            return data if isinstance(data, dict) else None
    except (KeyError, tarfile.TarError, json.JSONDecodeError, UnicodeDecodeError, OSError):
        return None


def _read_backup_package_text(path: Path, member_name: str) -> str | None:
    try:
        with tarfile.open(path, "r:gz") as archive:
            member = archive.getmember(member_name)
            extracted = archive.extractfile(member)
            if extracted is None:
                return None
            return extracted.read().decode("utf-8")
    except (KeyError, tarfile.TarError, UnicodeDecodeError, OSError):
        return None


def _sha256_tar_member(archive: tarfile.TarFile, member_name: str) -> str | None:
    try:
        member = archive.getmember(member_name)
        extracted = archive.extractfile(member)
        if extracted is None:
            return None
        digest = hashlib.sha256()
        for chunk in iter(lambda: extracted.read(1024 * 1024), b""):
            digest.update(chunk)
        return digest.hexdigest()
    except (KeyError, tarfile.TarError, OSError):
        return None


def _parse_checksums_file(value: str | None) -> dict[str, str]:
    checksums: dict[str, str] = {}
    for line in str(value or "").splitlines():
        clean = line.strip()
        if not clean:
            continue
        parts = clean.split(None, 1)
        if len(parts) != 2:
            continue
        digest, relative_path = parts
        checksums[relative_path.strip()] = digest.strip()
    return checksums


def _is_safe_tar_member_name(member_name: str) -> bool:
    path = Path(str(member_name or ""))
    if path.is_absolute():
        return False
    return ".." not in path.parts


def _is_expected_backup_member(member_name: str) -> bool:
    return (
        member_name in {"metadata.json", "manifest.json", "checksums.sha256"}
        or member_name.startswith("mariadb/")
        or member_name.startswith("minio/")
    )


def _validate_backup_tar_members(archive: tarfile.TarFile) -> set[str]:
    member_names: set[str] = set()
    total_size = 0
    for index, member in enumerate(archive.getmembers(), start=1):
        if index > BACKUP_IMPORT_MAX_MEMBERS:
            raise BadRequestException("El paquete contiene demasiados miembros internos.")

        if not _is_safe_tar_member_name(member.name) or not _is_expected_backup_member(member.name):
            raise BadRequestException(f"Miembro inseguro o inesperado dentro del paquete: {member.name}")

        if member.issym() or member.islnk() or member.isdev():
            raise BadRequestException(f"El paquete contiene un tipo de miembro no permitido: {member.name}")

        if member.isfile():
            total_size += int(member.size or 0)
            if total_size > BACKUP_IMPORT_MAX_UNCOMPRESSED_BYTES:
                raise BadRequestException("El tamaño descomprimido del paquete excede el límite permitido.")
        elif not member.isdir():
            raise BadRequestException(f"El paquete contiene un tipo de miembro no permitido: {member.name}")

        member_names.add(member.name)
    return member_names


def _scope_from_backup_path(path: Path, metadata: dict | None) -> str | None:
    raw_scope = str((metadata or {}).get("scope") or "").strip()
    if raw_scope in BACKUP_SCOPES:
        return raw_scope
    name = path.name
    for scope in BACKUP_SCOPES:
        if name.startswith(f"backup-{scope}-"):
            return scope
    return None


def _normalize_policy_config(policy: dict) -> dict:
    aliases = {
        "pathPrefix": "path_prefix",
        "fileFormat": "file_format",
        "verificationMode": "verification_mode",
        "notifyByEmail": "notify_by_email",
        "notifyRecipientName": "notify_recipient_name",
        "notifyRecipientEmail": "notify_recipient_email",
    }
    normalized = dict(policy)
    for old_key, new_key in aliases.items():
        if old_key in normalized and new_key not in normalized:
            normalized[new_key] = normalized.pop(old_key)
    return normalized


def _normalize_policies_config(value: Any) -> dict:
    source = value if isinstance(value, dict) else DEFAULT_POLICIES
    normalized: dict[str, dict] = {}
    for scope in BACKUP_SCOPES:
        policy = source.get(scope) if isinstance(source.get(scope), dict) else DEFAULT_POLICIES[scope]
        normalized[scope] = _normalize_policy_config(policy)
    return normalized


def _actor_snapshot_from_session(db: Session, session: UserSession) -> dict:
    user = db.query(User).filter(User.id == session.user_id).first()
    return {
        "user_id": session.user_id,
        "username": session.username,
        "full_name": session.full_name,
        "email": getattr(user, "email", None) if user else None,
    }


def _actor_snapshot_from_json(value: str | None) -> dict | None:
    data = _json_loads(value, None)
    if not isinstance(data, dict):
        return None
    return {
        "user_id": data.get("user_id") or data.get("userId"),
        "username": data.get("username"),
        "full_name": data.get("full_name") or data.get("fullName"),
        "email": data.get("email"),
    }


def _actor_snapshot_user_id(actor_snapshot: dict | None) -> str | None:
    if not actor_snapshot:
        return None
    return actor_snapshot.get("user_id") or actor_snapshot.get("userId")


def _localnow() -> datetime:
    return datetime.now(ZoneInfo(SCHEDULER_TIMEZONE))


def _current_slot(current_local_dt: datetime) -> str:
    return current_local_dt.strftime("%Y%m%d%H%M")


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


async def _acquire_backup_tick_lock() -> str | None:
    redis = get_redis()
    token = str(uuid.uuid4())
    acquired = await redis.set(
        BACKUP_TICK_LOCK_KEY,
        token,
        ex=BACKUP_TICK_LOCK_TTL_SEC,
        nx=True,
    )
    return token if acquired else None


async def _release_backup_tick_lock(token: str | None) -> None:
    if not token:
        return
    redis = get_redis()
    current = await redis.get(BACKUP_TICK_LOCK_KEY)
    if current == token:
        await redis.delete(BACKUP_TICK_LOCK_KEY)


async def _claim_backup_schedule_slot(scope: str, slot: str) -> bool:
    redis = get_redis()
    key = f"system:backups:scheduled:{scope}:{slot}"
    return bool(await redis.set(key, "1", ex=BACKUP_SCHEDULE_SLOT_TTL_SEC, nx=True))


def _is_missing_backup_schema_error(exc: Exception) -> bool:
    text_value = str(exc).lower()
    return any(table in text_value for table in EXPECTED_TABLES) and (
        "doesn't exist" in text_value or "does not exist" in text_value or "no such table" in text_value
    )


def ensure_system_backups_schema_access(db: Session) -> None:
    try:
        inspector = inspect(db.get_bind())
        existing_tables = set(inspector.get_table_names())
    except Exception:
        db.query(SystemBackupSetting.id).limit(1).first()
        return

    missing_tables = sorted(EXPECTED_TABLES - existing_tables)
    if missing_tables:
        raise BadRequestException(
            "El esquema de respaldos aún no está disponible. "
            "Aplica el script SQL 20260524_1134_schema_system_backups.sql antes de usar este módulo."
        )


def _require_schema(db: Session) -> None:
    try:
        ensure_system_backups_schema_access(db)
    except BadRequestException:
        raise
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_backup_schema_error(exc):
            raise BadRequestException(
                "Las tablas de respaldos aún no están disponibles. Aplica el esquema antes de usar este módulo."
            )
        raise


def _get_settings_singleton(db: Session, *, actor_snapshot: dict | None = None) -> SystemBackupSetting:
    _require_schema(db)
    obj = db.query(SystemBackupSetting).filter(SystemBackupSetting.id == SYSTEM_BACKUP_SETTINGS_SINGLETON_ID).first()
    if obj:
        return obj

    now = utc_now_db()
    actor_user_id = _actor_snapshot_user_id(actor_snapshot)
    obj = SystemBackupSetting(
        id=SYSTEM_BACKUP_SETTINGS_SINGLETON_ID,
        retention_days=14,
        history_visible=True,
        backup_purge_queue="queue:backups / backup_purge",
        policies_json=_json_dumps(DEFAULT_POLICIES),
        created_at=now,
        created_by=actor_user_id,
        created_by_snapshot_json=_json_dumps(actor_snapshot) if actor_snapshot else None,
        updated_at=now,
        updated_by=actor_user_id,
        updated_by_snapshot_json=_json_dumps(actor_snapshot) if actor_snapshot else None,
    )
    db.add(obj)
    try:
        db.commit()
        db.refresh(obj)
    except IntegrityError:
        db.rollback()
    return db.query(SystemBackupSetting).filter(SystemBackupSetting.id == SYSTEM_BACKUP_SETTINGS_SINGLETON_ID).first()


def _ensure_operation_state_singleton(db: Session) -> SystemOperationState:
    _require_schema(db)
    obj = db.query(SystemOperationState).filter(SystemOperationState.id == SYSTEM_OPERATION_STATE_SINGLETON_ID).first()
    if obj:
        return obj
    obj = SystemOperationState(
        id=SYSTEM_OPERATION_STATE_SINGLETON_ID,
        mode="normal",
        updated_at=utc_now_db(),
        metadata_json=_json_dumps({}),
    )
    db.add(obj)
    try:
        db.commit()
        db.refresh(obj)
    except IntegrityError:
        db.rollback()
    return db.query(SystemOperationState).filter(SystemOperationState.id == SYSTEM_OPERATION_STATE_SINGLETON_ID).first()


def _build_config_response(obj: SystemBackupSetting) -> dict:
    return {
        "id": int(obj.id),
        "backup_retention_days": int(obj.retention_days),
        "backup_history_visible": bool(obj.history_visible),
        "backup_purge_queue": obj.backup_purge_queue,
        "policies": _normalize_policies_config(_json_loads(obj.policies_json, DEFAULT_POLICIES)),
        "created_at": _iso(obj.created_at),
        "updated_at": _iso(obj.updated_at),
        "created_by": _actor_snapshot_from_json(obj.created_by_snapshot_json),
        "updated_by": _actor_snapshot_from_json(obj.updated_by_snapshot_json),
    }


def _build_artifact_response(obj: SystemBackupArtifact) -> dict:
    return {
        "id": obj.id,
        "item_type": "artifact",
        "scope": obj.scope,
        "name": obj.name,
        "status": obj.status,
        "origin_type": obj.origin_type,
        "operation_type": None,
        "job_id": None,
        "artifact_id": obj.id,
        "storage_path": obj.storage_path,
        "file_path": obj.file_path,
        "size_bytes": int(obj.size_bytes or 0),
        "checksum_sha256": obj.checksum_sha256,
        "db_schema_version": obj.db_schema_version,
        "app_version": obj.app_version,
        "created_at": _iso(obj.created_at),
        "created_by": _actor_snapshot_from_json(obj.created_by_snapshot_json),
        "message": None,
    }


def _build_operation_history_response(obj: SystemBackupOperation) -> dict:
    scope_label = {
        "database": "base de datos",
        "objects": "adjuntos",
        "full": "respaldo completo",
    }.get(obj.scope, obj.scope)
    operation_label = "Restaurando" if obj.operation_type == "restore_backup" else "Procesando"
    return {
        "id": obj.id,
        "item_type": "operation",
        "scope": obj.scope,
        "name": f"{operation_label} {scope_label}",
        "status": obj.status,
        "origin_type": obj.trigger_source,
        "operation_type": obj.operation_type,
        "job_id": obj.job_id,
        "artifact_id": obj.artifact_id,
        "storage_path": obj.message or "Operación en curso",
        "file_path": None,
        "size_bytes": 0,
        "checksum_sha256": None,
        "db_schema_version": None,
        "app_version": None,
        "created_at": _iso(obj.requested_at),
        "created_by": _actor_snapshot_from_json(obj.requested_by_snapshot_json),
        "message": obj.message,
    }


def _build_purge_candidate_response(obj: SystemBackupArtifact) -> dict:
    return {
        "id": obj.id,
        "scope": obj.scope,
        "name": obj.name,
        "status": obj.status,
        "file_path": obj.file_path,
        "size_bytes": int(obj.size_bytes or 0),
        "created_at": _iso(obj.created_at),
    }


def _build_operation_response(obj: SystemBackupOperation) -> dict:
    return {
        "id": obj.id,
        "operation_type": obj.operation_type,
        "scope": obj.scope,
        "status": obj.status,
        "trigger_source": obj.trigger_source,
        "job_id": obj.job_id,
        "artifact_id": obj.artifact_id,
        "requested_at": _iso(obj.requested_at),
        "requested_by": _actor_snapshot_from_json(obj.requested_by_snapshot_json),
        "message": obj.message,
    }


def get_db_schema_version() -> str:
    for sql_dir in SCHEMA_SQL_DIR_CANDIDATES:
        if not sql_dir.exists():
            continue
        sql_files = sorted(sql_dir.glob("*.sql"))
        if not sql_files:
            continue
        digest = hashlib.sha256()
        for sql_file in sql_files:
            digest.update(sql_file.name.encode("utf-8"))
            digest.update(b"\0")
            digest.update(sql_file.read_bytes())
            digest.update(b"\0")
        latest_file = sql_files[-1].name
        full_hash = digest.hexdigest()
        return f"{latest_file}::sha256:{full_hash[:12]}"
    return "unavailable::sha256:unknown"


def reconcile_system_backup_artifacts(
    db: Session,
    *,
    actor_snapshot: dict | None = None,
    write_audit: bool = False,
) -> dict:
    _require_schema(db)
    backup_root = Path(BACKUP_STORAGE_ROOT)
    discovered_count = 0
    restored_count = 0
    missing_count = 0
    scanned_count = 0
    errors: list[str] = []

    package_paths = sorted(backup_root.rglob(BACKUP_PACKAGE_GLOB)) if backup_root.exists() else []
    for package_path in package_paths:
        scanned_count += 1
        metadata = _read_backup_package_json(package_path, "metadata.json")
        manifest = _read_backup_package_json(package_path, "manifest.json")
        scope = _scope_from_backup_path(package_path, metadata)
        if not metadata or not manifest or not scope:
            errors.append(f"Paquete inválido o incompleto: {package_path}")
            continue

        checksum = _sha256_file(package_path)
        existing = (
            db.query(SystemBackupArtifact)
            .filter(
                (SystemBackupArtifact.file_path == str(package_path))
                | (SystemBackupArtifact.checksum_sha256 == checksum)
            )
            .first()
        )
        if existing:
            if existing.deleted_at is None and existing.status == "missing":
                existing.status = "available"
                existing.updated_at = utc_now_db()
                restored_count += 1
            continue

        artifact_id = str(metadata.get("artifactId") or uuid.uuid4())
        if db.query(SystemBackupArtifact).filter(SystemBackupArtifact.id == artifact_id).first():
            artifact_id = str(uuid.uuid4())

        created_at = _parse_iso_datetime(str(metadata.get("createdAt") or "")) or datetime.fromtimestamp(
            package_path.stat().st_mtime,
            tz=timezone.utc,
        ).replace(tzinfo=None)
        actor = metadata.get("actor") if isinstance(metadata.get("actor"), dict) else None
        artifact = SystemBackupArtifact(
            id=artifact_id,
            scope=scope,
            name=package_path.name,
            status="available",
            origin_type="filesystem",
            storage_path=str(package_path),
            file_path=str(package_path),
            size_bytes=package_path.stat().st_size,
            checksum_sha256=checksum,
            db_schema_version=metadata.get("dbSchemaVersion"),
            app_version=metadata.get("appVersion"),
            metadata_json=_json_dumps(metadata),
            manifest_json=_json_dumps(manifest),
            created_at=created_at,
            created_by=_actor_snapshot_user_id(actor),
            created_by_snapshot_json=_json_dumps(actor) if actor else None,
            updated_at=utc_now_db(),
        )
        db.add(artifact)
        discovered_count += 1

    available_artifacts = (
        db.query(SystemBackupArtifact)
        .filter(SystemBackupArtifact.deleted_at.is_(None))
        .filter(SystemBackupArtifact.status == "available")
        .all()
    )
    for artifact in available_artifacts:
        if not artifact.file_path:
            continue
        if not Path(str(artifact.file_path)).exists():
            artifact.status = "missing"
            artifact.updated_at = utc_now_db()
            missing_count += 1

    if write_audit:
        _create_audit_event(
            db,
            event_type="backup_artifacts_reconciled",
            actor_snapshot=actor_snapshot,
            details={
                "discoveredCount": discovered_count,
                "restoredCount": restored_count,
                "missingCount": missing_count,
                "scannedCount": scanned_count,
                "errors": errors,
            },
        )
    db.commit()
    return {
        "discovered_count": discovered_count,
        "missing_count": missing_count,
        "restored_count": restored_count,
        "scanned_count": scanned_count,
        "errors": errors,
    }


def get_system_backups_config(db: Session) -> dict:
    obj = _get_settings_singleton(db)
    return _build_config_response(obj)


def update_system_backups_config(
    db: Session,
    body: SystemBackupsConfigRequest,
    *,
    session: UserSession,
) -> dict:
    actor_snapshot = _actor_snapshot_from_session(db, session)
    obj = _get_settings_singleton(db, actor_snapshot=actor_snapshot)
    now = utc_now_db()
    obj.retention_days = body.backup_retention_days
    obj.history_visible = body.backup_history_visible
    obj.backup_purge_queue = body.backup_purge_queue
    obj.policies_json = _json_dumps(body.policies.model_dump())
    obj.updated_at = now
    obj.updated_by = session.user_id
    obj.updated_by_snapshot_json = _json_dumps(actor_snapshot)
    if not obj.created_by:
        obj.created_by = session.user_id
        obj.created_by_snapshot_json = _json_dumps(actor_snapshot)

    db.commit()
    db.refresh(obj)
    _create_audit_event(
        db,
        event_type="backup_config_updated",
        actor_snapshot=actor_snapshot,
        details={"retentionDays": body.backup_retention_days, "historyVisible": body.backup_history_visible},
    )
    db.commit()
    return _build_config_response(obj)


async def get_system_backups_status(db: Session) -> dict:
    _ensure_operation_state_singleton(db)
    reconcile_system_backup_artifacts(db)
    redis = get_redis()
    queue_size = int(await redis.llen(BACKUP_QUEUE))
    dlq_size = int(await redis.llen(BACKUP_DLQ_QUEUE))
    latest_operation = (
        db.query(SystemBackupOperation)
        .order_by(SystemBackupOperation.requested_at.desc())
        .first()
    )
    latest_artifact = (
        db.query(SystemBackupArtifact)
        .filter(SystemBackupArtifact.deleted_at.is_(None))
        .order_by(SystemBackupArtifact.created_at.desc())
        .first()
    )
    return {
        "queue": {
            "queue": BACKUP_QUEUE,
            "size": queue_size,
            "dlq_queue": BACKUP_DLQ_QUEUE,
            "dlq_size": dlq_size,
        },
        "latest_operation": _build_operation_response(latest_operation) if latest_operation else None,
        "latest_artifact": _build_artifact_response(latest_artifact) if latest_artifact else None,
        "db_schema_version": get_db_schema_version(),
        "backup_storage_root": BACKUP_STORAGE_ROOT,
    }


def get_system_backups_history(db: Session, *, limit: int = 50) -> dict:
    _require_schema(db)
    reconcile_system_backup_artifacts(db)
    artifacts = (
        db.query(SystemBackupArtifact)
        .filter(SystemBackupArtifact.deleted_at.is_(None))
        .order_by(SystemBackupArtifact.created_at.desc())
        .limit(max(1, min(int(limit), 200)))
        .all()
    )
    active_operations = (
        db.query(SystemBackupOperation)
        .filter(SystemBackupOperation.operation_type.in_(("db_backup", "object_backup", "full_backup", "restore_backup")))
        .filter(SystemBackupOperation.status.in_(("queued", "running")))
        .order_by(SystemBackupOperation.requested_at.desc())
        .all()
    )
    items = [
        *[_build_operation_history_response(item) for item in active_operations],
        *[_build_artifact_response(item) for item in artifacts],
    ]
    items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return {"items": items[: max(1, min(int(limit), 200))]}


def get_system_backup_operation(db: Session, *, operation_id: str) -> dict:
    _require_schema(db)
    operation = (
        db.query(SystemBackupOperation)
        .filter(SystemBackupOperation.id == str(operation_id))
        .first()
    )
    if not operation:
        raise NotFoundException("La operación de respaldo solicitada no existe.")
    return _build_operation_response(operation)


async def _remove_job_from_redis_queue(*, queue_name: str, job_id: str) -> tuple[bool, int]:
    redis = get_redis()
    raw_jobs = await redis.lrange(queue_name, 0, -1)
    scanned = len(raw_jobs or [])
    for raw_job in raw_jobs or []:
        try:
            job = json.loads(raw_job)
        except (TypeError, json.JSONDecodeError):
            continue
        if str(job.get("job_id") or "") != str(job_id):
            continue
        removed = int(await redis.lrem(queue_name, 1, raw_job) or 0)
        return removed > 0, scanned
    return False, scanned


async def _job_exists_in_queue(*, queue_name: str, job_id: str) -> bool:
    redis = get_redis()
    raw_jobs = await redis.lrange(queue_name, 0, -1)
    for raw_job in raw_jobs or []:
        try:
            job = json.loads(raw_job)
        except (TypeError, json.JSONDecodeError):
            continue
        if str(job.get("job_id") or "") == str(job_id):
            return True
        payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}
        nested_job = payload.get("job") if isinstance(payload.get("job"), dict) else {}
        if str(nested_job.get("job_id") or "") == str(job_id):
            return True
    return False


async def cancel_system_backup_operation(
    db: Session,
    *,
    operation_id: str,
    session: UserSession,
) -> dict:
    _require_schema(db)
    operation = (
        db.query(SystemBackupOperation)
        .filter(SystemBackupOperation.id == str(operation_id))
        .first()
    )
    if not operation:
        raise NotFoundException("La operación de respaldo solicitada no existe.")

    if operation.status == "running":
        raise BadRequestException("No es seguro cancelar una operación de respaldo que ya está en ejecución.")
    if operation.status not in {"queued"}:
        raise BadRequestException("Solo se pueden cancelar operaciones en cola.")

    actor_snapshot = _actor_snapshot_from_session(db, session)
    removed_from_queue = False
    scanned_queue_count = 0
    present_in_dlq = False
    if operation.job_id:
        removed_from_queue, scanned_queue_count = await _remove_job_from_redis_queue(
            queue_name=BACKUP_QUEUE,
            job_id=operation.job_id,
        )
        present_in_dlq = await _job_exists_in_queue(
            queue_name=BACKUP_DLQ_QUEUE,
            job_id=operation.job_id,
        )

    operation.status = "cancelled"
    operation.finished_at = utc_now_db()
    operation.message = (
        "Operación cancelada administrativamente antes de ejecución."
        if removed_from_queue
        else "Operación cancelada administrativamente; el job no estaba activo en la cola."
    )
    operation.error_message = None
    operation.result_json = _json_dumps(
        {
            "cancelledBy": actor_snapshot,
            "removedFromQueue": removed_from_queue,
            "scannedQueueCount": scanned_queue_count,
            "presentInDlq": present_in_dlq,
        }
    )

    _create_audit_event(
        db,
        event_type="backup_operation_cancelled",
        actor_snapshot=actor_snapshot,
        operation_id=operation.id,
        artifact_id=operation.artifact_id,
        details={
            "operationType": operation.operation_type,
            "scope": operation.scope,
            "jobId": operation.job_id,
            "removedFromQueue": removed_from_queue,
            "presentInDlq": present_in_dlq,
            "reason": "admin_cancel",
        },
    )
    db.commit()
    db.refresh(operation)

    await publish_backup_event(
        status="cancelled",
        scope=operation.scope,
        action=operation.operation_type,
        message=operation.message or "Operación cancelada administrativamente.",
        trigger="manual_cancel",
        operation_id=operation.id,
        job_id=operation.job_id,
        artifact_id=operation.artifact_id,
        actor_user_id=session.user_id,
        metadata={
            "removedFromQueue": removed_from_queue,
            "presentInDlq": present_in_dlq,
        },
    )

    return _build_operation_response(operation)


def inspect_system_backup_artifact(db: Session, *, artifact_id: str) -> dict:
    _require_schema(db)
    reconcile_system_backup_artifacts(db)
    artifact = (
        db.query(SystemBackupArtifact)
        .filter(SystemBackupArtifact.id == str(artifact_id))
        .filter(SystemBackupArtifact.deleted_at.is_(None))
        .first()
    )
    if not artifact:
        raise NotFoundException("El respaldo solicitado no existe en el catálogo.")

    package_path = Path(str(artifact.file_path or artifact.storage_path or ""))
    errors: list[str] = []
    warnings: list[str] = []
    metadata: dict = {}
    manifest: dict = {}
    sections: dict[str, dict] = {}
    files: list[dict] = []
    package_sha256: str | None = None
    package_sha256_matches_catalog: bool | None = None

    if not package_path.exists() or not package_path.is_file():
        errors.append("El archivo físico del respaldo no existe.")
        return {
            "artifact": _build_artifact_response(artifact),
            "package_exists": False,
            "package_sha256": None,
            "package_sha256_matches_catalog": None,
            "metadata": {},
            "manifest": {},
            "sections": {},
            "files": [],
            "errors": errors,
            "warnings": warnings,
            "is_valid": False,
        }

    package_sha256 = _sha256_file(package_path)
    if artifact.checksum_sha256:
        package_sha256_matches_catalog = package_sha256 == artifact.checksum_sha256
        if not package_sha256_matches_catalog:
            errors.append("El SHA-256 del paquete no coincide con el catálogo.")
    else:
        warnings.append("El catálogo no tiene SHA-256 del paquete para comparar.")

    try:
        with tarfile.open(package_path, "r:gz") as archive:
            try:
                member_names = _validate_backup_tar_members(archive)
            except BadRequestException as exc:
                errors.append(str(exc))
                member_names = set(archive.getnames())
            metadata = _read_backup_package_json(package_path, "metadata.json") or {}
            manifest = _read_backup_package_json(package_path, "manifest.json") or {}
            checksums = _parse_checksums_file(_read_backup_package_text(package_path, "checksums.sha256"))

            if not metadata:
                errors.append("No se pudo leer metadata.json.")
            if not manifest:
                errors.append("No se pudo leer manifest.json.")
            if not checksums:
                errors.append("No se pudo leer checksums.sha256.")

            raw_sections = manifest.get("sections") if isinstance(manifest.get("sections"), dict) else {}
            for section_key, section_value in raw_sections.items():
                if not isinstance(section_value, dict):
                    continue
                sections[str(section_key)] = {
                    "enabled": bool(section_value.get("enabled")),
                    "path": section_value.get("path"),
                    "format": section_value.get("format"),
                    "data_only": section_value.get("dataOnly"),
                    "buckets": section_value.get("buckets") if isinstance(section_value.get("buckets"), list) else [],
                }

            for relative_path, expected_sha256 in sorted(checksums.items()):
                if relative_path not in member_names:
                    files.append({
                        "path": relative_path,
                        "size_bytes": None,
                        "expected_sha256": expected_sha256,
                        "actual_sha256": None,
                        "status": "missing",
                    })
                    errors.append(f"Archivo interno faltante: {relative_path}")
                    continue
                member = archive.getmember(relative_path)
                actual_sha256 = _sha256_tar_member(archive, relative_path)
                status = "ok" if actual_sha256 == expected_sha256 else "mismatch"
                if status != "ok":
                    errors.append(f"Checksum interno no coincide: {relative_path}")
                files.append({
                    "path": relative_path,
                    "size_bytes": int(member.size or 0),
                    "expected_sha256": expected_sha256,
                    "actual_sha256": actual_sha256,
                    "status": status,
                })

            for required_member in ("metadata.json", "manifest.json", "checksums.sha256"):
                if required_member not in member_names:
                    errors.append(f"Miembro requerido faltante: {required_member}")
    except tarfile.TarError:
        errors.append("El paquete no es un tar.gz válido.")
    except OSError as exc:
        errors.append(f"No se pudo leer el paquete: {exc}")

    metadata_scope = str(metadata.get("scope") or "")
    if metadata_scope and metadata_scope != artifact.scope:
        warnings.append("El scope de metadata no coincide con el scope catalogado.")

    return {
        "artifact": _build_artifact_response(artifact),
        "package_exists": True,
        "package_sha256": package_sha256,
        "package_sha256_matches_catalog": package_sha256_matches_catalog,
        "metadata": metadata,
        "manifest": manifest,
        "sections": sections,
        "files": files,
        "errors": errors,
        "warnings": warnings,
        "is_valid": not errors,
    }


def get_system_backup_artifact_download(db: Session, *, artifact_id: str) -> dict:
    _require_schema(db)
    reconcile_system_backup_artifacts(db)
    artifact = (
        db.query(SystemBackupArtifact)
        .filter(SystemBackupArtifact.id == str(artifact_id))
        .filter(SystemBackupArtifact.deleted_at.is_(None))
        .first()
    )
    if not artifact:
        raise NotFoundException("El respaldo solicitado no existe en el catálogo.")
    if artifact.status != "available":
        raise BadRequestException("Solo se pueden descargar respaldos disponibles.")

    package_path = Path(str(artifact.file_path or artifact.storage_path or "")).resolve(strict=False)
    backup_root = Path(BACKUP_STORAGE_ROOT).resolve(strict=False)
    if not package_path.is_file():
        raise NotFoundException("El archivo físico del respaldo no existe.")
    try:
        package_path.relative_to(backup_root)
    except ValueError:
        raise BadRequestException("La ruta del respaldo está fuera del directorio permitido.")

    return {
        "path": str(package_path),
        "filename": artifact.name or package_path.name,
    }


def _get_purge_preview_data(db: Session) -> dict:
    reconcile_system_backup_artifacts(db)
    settings_obj = _get_settings_singleton(db)
    retention_days = max(1, int(settings_obj.retention_days or 1))
    cutoff = utc_now_db() - timedelta(days=retention_days)

    active_artifacts = (
        db.query(SystemBackupArtifact)
        .filter(SystemBackupArtifact.deleted_at.is_(None))
        .filter(SystemBackupArtifact.status == "available")
        .order_by(SystemBackupArtifact.scope.asc(), SystemBackupArtifact.created_at.desc())
        .all()
    )

    latest_by_scope: dict[str, str] = {}
    for artifact in active_artifacts:
        latest_by_scope.setdefault(str(artifact.scope), str(artifact.id))

    candidates = [
        artifact
        for artifact in active_artifacts
        if artifact.created_at
        and artifact.created_at < cutoff
        and str(artifact.id) != latest_by_scope.get(str(artifact.scope))
    ]
    candidate_items = [_build_purge_candidate_response(item) for item in candidates]
    return {
        "retention_days": retention_days,
        "cutoff_at": assume_utc(cutoff).isoformat(),
        "keep_latest_per_scope": True,
        "total_count": len(candidate_items),
        "total_size_bytes": sum(int(item["size_bytes"] or 0) for item in candidate_items),
        "candidates": candidate_items,
    }


def get_system_backups_purge_preview(db: Session) -> dict:
    _require_schema(db)
    return _get_purge_preview_data(db)


def sync_system_backup_artifacts(db: Session, *, session: UserSession) -> dict:
    actor_snapshot = _actor_snapshot_from_session(db, session)
    return reconcile_system_backup_artifacts(db, actor_snapshot=actor_snapshot, write_audit=True)


def _import_destination_path(scope: str) -> Path:
    backup_root = Path(BACKUP_STORAGE_ROOT)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    suffix = uuid.uuid4().hex[:8]
    candidate = backup_root / f"backup-{scope}-{timestamp}-imported-{suffix}.tar.gz"
    while candidate.exists():
        suffix = uuid.uuid4().hex[:8]
        candidate = backup_root / f"backup-{scope}-{timestamp}-imported-{suffix}.tar.gz"
    return candidate


def _validate_import_package(path: Path, original_filename: str) -> tuple[dict, dict, str]:
    clean_name = Path(str(original_filename or "")).name
    if not clean_name.endswith(".tar.gz"):
        raise BadRequestException("El archivo seleccionado debe tener extensión .tar.gz.")

    if path.stat().st_size > BACKUP_IMPORT_MAX_BYTES:
        raise BadRequestException("El paquete excede el tamaño máximo permitido para importación.")

    try:
        with tarfile.open(path, "r:gz") as archive:
            members = _validate_backup_tar_members(archive)
    except tarfile.TarError as exc:
        raise BadRequestException("El archivo seleccionado no es un paquete tar.gz válido.") from exc
    except OSError as exc:
        raise BadRequestException("No fue posible leer el paquete seleccionado.") from exc

    missing = [member for member in ("metadata.json", "manifest.json", "checksums.sha256") if member not in members]
    if missing:
        raise BadRequestException(f"El paquete no contiene los miembros requeridos: {', '.join(missing)}.")

    metadata = _read_backup_package_json(path, "metadata.json")
    manifest = _read_backup_package_json(path, "manifest.json")
    if not metadata or not manifest:
        raise BadRequestException("El paquete no contiene metadata.json o manifest.json válidos.")

    checksums = _parse_checksums_file(_read_backup_package_text(path, "checksums.sha256"))
    if not checksums:
        raise BadRequestException("El paquete no contiene checksums.sha256 válido.")
    for relative_path in checksums:
        if not _is_safe_tar_member_name(relative_path) or not _is_expected_backup_member(relative_path):
            raise BadRequestException(f"checksums.sha256 referencia una ruta insegura: {relative_path}")
        if relative_path not in members:
            raise BadRequestException(f"checksums.sha256 referencia un archivo faltante: {relative_path}")
    try:
        with tarfile.open(path, "r:gz") as archive:
            for relative_path, expected_sha256 in checksums.items():
                actual_sha256 = _sha256_tar_member(archive, relative_path)
                if not actual_sha256 or actual_sha256 != expected_sha256:
                    raise BadRequestException(f"Checksum interno no coincide: {relative_path}")
    except tarfile.TarError as exc:
        raise BadRequestException("El archivo seleccionado no es un paquete tar.gz válido.") from exc
    except OSError as exc:
        raise BadRequestException("No fue posible verificar el paquete seleccionado.") from exc

    scope = _scope_from_backup_path(Path(original_filename), metadata)
    if scope not in BACKUP_SCOPES:
        raise BadRequestException("No fue posible determinar si el respaldo es database, objects o full.")
    return metadata, manifest, str(scope)


def import_system_backup_package_from_path(
    db: Session,
    *,
    source_path: Path,
    original_filename: str,
    session: UserSession,
) -> dict:
    _require_schema(db)
    actor_snapshot = _actor_snapshot_from_session(db, session)
    metadata, manifest, scope = _validate_import_package(source_path, original_filename)
    checksum = _sha256_file(source_path)

    existing = (
        db.query(SystemBackupArtifact)
        .filter(SystemBackupArtifact.deleted_at.is_(None))
        .filter(SystemBackupArtifact.checksum_sha256 == checksum)
        .first()
    )
    if existing:
        raise BadRequestException("Este paquete ya existe en el catálogo de respaldos.")

    destination = _import_destination_path(scope)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source_path), str(destination))

    now = utc_now_db()
    artifact_id = str(uuid.uuid4())
    imported_metadata = dict(metadata)
    imported_metadata["imported"] = {
        "at": now.replace(tzinfo=timezone.utc).isoformat(),
        "originalFilename": Path(str(original_filename or "")).name or destination.name,
        "actor": actor_snapshot,
    }
    artifact = SystemBackupArtifact(
        id=artifact_id,
        scope=scope,
        name=destination.name,
        status="available",
        origin_type="imported",
        storage_path=str(destination),
        file_path=str(destination),
        size_bytes=destination.stat().st_size,
        checksum_sha256=checksum,
        db_schema_version=metadata.get("dbSchemaVersion"),
        app_version=metadata.get("appVersion"),
        metadata_json=_json_dumps(imported_metadata),
        manifest_json=_json_dumps(manifest),
        created_at=now,
        created_by=session.user_id,
        created_by_snapshot_json=_json_dumps(actor_snapshot),
        updated_at=now,
    )
    db.add(artifact)
    _create_audit_event(
        db,
        event_type="backup_package_imported",
        actor_snapshot=actor_snapshot,
        artifact_id=artifact_id,
        details={
            "scope": scope,
            "name": destination.name,
            "originalFilename": Path(str(original_filename or "")).name,
            "sizeBytes": int(artifact.size_bytes or 0),
            "checksumSha256": checksum,
            "filePath": str(destination),
        },
    )
    db.commit()
    return {
        "artifact": _build_artifact_response(artifact),
        "message": f"Paquete importado correctamente como {destination.name}.",
    }


def _create_audit_event(
    db: Session,
    *,
    event_type: str,
    actor_snapshot: dict | None,
    operation_id: str | None = None,
    artifact_id: str | None = None,
    details: dict | None = None,
) -> None:
    db.add(
        SystemBackupAuditEvent(
            event_at=utc_now_db(),
            event_type=event_type,
            operation_id=operation_id,
            artifact_id=artifact_id,
            actor_user_id=_actor_snapshot_user_id(actor_snapshot),
            actor_snapshot_json=_json_dumps(actor_snapshot) if actor_snapshot else None,
            details_json=_json_dumps(details or {}),
        )
    )


async def _enqueue_backup_job(action: str, payload: dict, *, job_id: str | None = None) -> str:
    job_id = job_id or str(uuid.uuid4())
    job = {
        "job_id": job_id,
        "type": action,
        "queue": BACKUP_QUEUE,
        "attempt": 1,
        "payload": payload,
    }
    redis = get_redis()
    await redis.rpush(BACKUP_QUEUE, json.dumps(job, ensure_ascii=False))
    return job_id


def _mark_operation_enqueue_failed(
    db: Session,
    *,
    operation_id: str,
    actor_snapshot: dict | None,
    error: Exception,
) -> None:
    operation = (
        db.query(SystemBackupOperation)
        .filter(SystemBackupOperation.id == operation_id)
        .first()
    )
    if operation:
        operation.status = "failed"
        operation.finished_at = utc_now_db()
        operation.message = "No fue posible encolar la operación en Redis."
        operation.error_message = str(error)

    _create_audit_event(
        db,
        event_type="backup_enqueue_failed",
        actor_snapshot=actor_snapshot,
        operation_id=operation_id,
        details={"error": str(error)},
    )
    db.commit()


async def _enqueue_backup_operation(
    db: Session,
    *,
    scope: str,
    trigger_source: str,
    actor_snapshot: dict | None = None,
    requested_by_id: str | None = None,
    scheduled_slot: str | None = None,
) -> dict:
    normalized_scope = str(scope or "").strip()
    if normalized_scope not in BACKUP_SCOPES:
        raise BadRequestException("El tipo de respaldo solicitado no es válido.")

    settings_obj = _get_settings_singleton(db, actor_snapshot=actor_snapshot)
    policies = _normalize_policies_config(_json_loads(settings_obj.policies_json, DEFAULT_POLICIES))
    policy = policies.get(normalized_scope)
    if not isinstance(policy, dict):
        raise BadRequestException("La política de respaldo solicitada no está configurada.")

    now = utc_now()
    queued_at = now.isoformat()
    operation_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    action = {
        "database": "db_backup",
        "objects": "object_backup",
        "full": "full_backup",
    }[normalized_scope]
    db_schema_version = get_db_schema_version()
    payload = {
        "operation_id": operation_id,
        "scope": normalized_scope,
        "policy": policy,
        "trigger_source": trigger_source,
        "requested_by_id": requested_by_id,
        "requested_by_snapshot": actor_snapshot,
        "queued_at": queued_at,
        "job_id": job_id,
        "scheduled_slot": scheduled_slot,
        "app_version": settings.app_version or settings.env_name,
        "db_schema_version": db_schema_version,
        "backup_storage_root": BACKUP_STORAGE_ROOT,
    }

    operation = SystemBackupOperation(
        id=operation_id,
        operation_type=action,
        scope=normalized_scope,
        status="queued",
        trigger_source=trigger_source,
        job_id=job_id,
        requested_at=now.replace(tzinfo=None),
        requested_by=requested_by_id,
        requested_by_snapshot_json=_json_dumps(actor_snapshot),
        message=f"Respaldo {normalized_scope} encolado para backup-worker.",
        payload_json=_json_dumps(payload),
    )
    db.add(operation)
    _create_audit_event(
        db,
        event_type="backup_manual_requested" if trigger_source == "manual" else "backup_scheduled_requested",
        actor_snapshot=actor_snapshot,
        operation_id=operation_id,
        details={
            "scope": normalized_scope,
            "jobId": job_id,
            "action": action,
            "scheduledSlot": scheduled_slot,
            "triggerSource": trigger_source,
        },
    )
    db.commit()

    try:
        await _enqueue_backup_job(action, payload, job_id=job_id)
    except Exception as exc:
        _mark_operation_enqueue_failed(
            db,
            operation_id=operation_id,
            actor_snapshot=actor_snapshot,
            error=exc,
        )
        raise

    return {
        "operation_id": operation_id,
        "job_id": job_id,
        "action": action,
        "scope": normalized_scope,
        "status": "queued",
        "queued_at": queued_at,
        "message": f"Respaldo {normalized_scope} encolado correctamente.",
    }


async def run_system_backup_now(
    db: Session,
    *,
    scope: str,
    session: UserSession,
) -> dict:
    actor_snapshot = _actor_snapshot_from_session(db, session)
    return await _enqueue_backup_operation(
        db,
        scope=scope,
        trigger_source="manual",
        actor_snapshot=actor_snapshot,
        requested_by_id=session.user_id,
    )


async def run_system_backups_tick(db: Session) -> dict:
    current_local_dt = _localnow()
    current_slot = _current_slot(current_local_dt)
    lock_token = await _acquire_backup_tick_lock()

    if not lock_token:
        return {
            "current_slot": current_slot,
            "current_time": current_local_dt.isoformat(),
            "timezone": SCHEDULER_TIMEZONE,
            "enqueued": [],
            "skipped": [
                {
                    "scope": "all",
                    "action": "backup_tick",
                    "reason": "tick_locked",
                    "job_id": None,
                }
            ],
        }

    try:
        settings_obj = _get_settings_singleton(db)
        policies = _normalize_policies_config(_json_loads(settings_obj.policies_json, DEFAULT_POLICIES))
        enqueued: list[dict] = []
        skipped: list[dict] = []

        for scope in BACKUP_SCOPES:
            policy = policies.get(scope) if isinstance(policies, dict) else None
            if not isinstance(policy, dict):
                skipped.append({"scope": scope, "action": None, "reason": "missing_policy", "job_id": None})
                continue

            if not bool(policy.get("enabled")):
                skipped.append({"scope": scope, "action": None, "reason": "disabled", "job_id": None})
                continue

            cron_expression = str(policy.get("cron") or "").strip()
            if not _cron_matches(cron_expression, current_local_dt):
                skipped.append({"scope": scope, "action": None, "reason": "not_due", "job_id": None})
                continue

            if not await _claim_backup_schedule_slot(scope, current_slot):
                skipped.append({"scope": scope, "action": None, "reason": "already_enqueued", "job_id": None})
                continue

            result = await _enqueue_backup_operation(
                db,
                scope=scope,
                trigger_source="scheduled",
                actor_snapshot=None,
                requested_by_id=None,
                scheduled_slot=current_slot,
            )
            enqueued.append({
                "scope": result["scope"],
                "action": result["action"],
                "reason": "cron_match",
                "job_id": result["job_id"],
            })

        return {
            "current_slot": current_slot,
            "current_time": current_local_dt.isoformat(),
            "timezone": SCHEDULER_TIMEZONE,
            "enqueued": enqueued,
            "skipped": skipped,
        }
    finally:
        await _release_backup_tick_lock(lock_token)


async def run_system_backups_purge(
    db: Session,
    *,
    session: UserSession,
) -> dict:
    actor_snapshot = _actor_snapshot_from_session(db, session)
    settings_obj = _get_settings_singleton(db, actor_snapshot=actor_snapshot)
    preview = _get_purge_preview_data(db)

    now = utc_now()
    queued_at = now.isoformat()
    operation_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    action = "backup_purge"
    payload = {
        "operation_id": operation_id,
        "scope": "all",
        "trigger_source": "manual",
        "requested_by_id": session.user_id,
        "requested_by_snapshot": actor_snapshot,
        "queued_at": queued_at,
        "job_id": job_id,
        "retention_days": int(settings_obj.retention_days or 1),
        "cutoff_at": preview["cutoff_at"],
        "keep_latest_per_scope": True,
        "candidates": preview["candidates"],
        "backup_storage_root": BACKUP_STORAGE_ROOT,
    }

    operation = SystemBackupOperation(
        id=operation_id,
        operation_type=action,
        scope="all",
        status="queued",
        trigger_source="manual",
        job_id=job_id,
        requested_at=now.replace(tzinfo=None),
        requested_by=session.user_id,
        requested_by_snapshot_json=_json_dumps(actor_snapshot),
        message=f"Limpieza de respaldos encolada para backup-worker ({preview['total_count']} candidatos).",
        payload_json=_json_dumps(payload),
    )
    db.add(operation)
    _create_audit_event(
        db,
        event_type="backup_purge_requested",
        actor_snapshot=actor_snapshot,
        operation_id=operation_id,
        details={
            "jobId": job_id,
            "candidateCount": preview["total_count"],
            "totalSizeBytes": preview["total_size_bytes"],
            "retentionDays": preview["retention_days"],
            "cutoffAt": preview["cutoff_at"],
        },
    )
    db.commit()

    try:
        await _enqueue_backup_job(action, payload, job_id=job_id)
    except Exception as exc:
        _mark_operation_enqueue_failed(
            db,
            operation_id=operation_id,
            actor_snapshot=actor_snapshot,
            error=exc,
        )
        raise

    return {
        "operation_id": operation_id,
        "job_id": job_id,
        "action": action,
        "scope": "all",
        "status": "queued",
        "queued_at": queued_at,
        "message": f"Limpieza de respaldos encolada correctamente ({preview['total_count']} candidatos).",
    }


async def run_system_backup_artifact_purge(
    db: Session,
    *,
    artifact_id: str,
    session: UserSession,
) -> dict:
    actor_snapshot = _actor_snapshot_from_session(db, session)
    reconcile_system_backup_artifacts(db)
    artifact = (
        db.query(SystemBackupArtifact)
        .filter(SystemBackupArtifact.id == str(artifact_id))
        .filter(SystemBackupArtifact.deleted_at.is_(None))
        .first()
    )
    if not artifact:
        raise NotFoundException("El respaldo solicitado no existe en el catálogo.")
    if artifact.status not in {"available", "missing"}:
        raise BadRequestException("Solo se pueden eliminar respaldos disponibles o no encontrados físicamente.")

    available_same_scope_count = (
        db.query(SystemBackupArtifact)
        .filter(SystemBackupArtifact.deleted_at.is_(None))
        .filter(SystemBackupArtifact.status == "available")
        .filter(SystemBackupArtifact.scope == artifact.scope)
        .count()
    )
    is_last_available_scope = artifact.status == "available" and int(available_same_scope_count or 0) <= 1

    now = utc_now()
    queued_at = now.isoformat()
    operation_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    action = "backup_purge"
    candidate = _build_purge_candidate_response(artifact)
    payload = {
        "operation_id": operation_id,
        "scope": artifact.scope,
        "trigger_source": "manual_delete",
        "requested_by_id": session.user_id,
        "requested_by_snapshot": actor_snapshot,
        "queued_at": queued_at,
        "job_id": job_id,
        "purge_mode": "manual_artifact",
        "keep_latest_per_scope": False,
        "is_last_available_scope": is_last_available_scope,
        "candidates": [candidate],
        "backup_storage_root": BACKUP_STORAGE_ROOT,
    }

    operation = SystemBackupOperation(
        id=operation_id,
        operation_type=action,
        scope=artifact.scope,
        status="queued",
        trigger_source="manual_delete",
        job_id=job_id,
        requested_at=now.replace(tzinfo=None),
        requested_by=session.user_id,
        requested_by_snapshot_json=_json_dumps(actor_snapshot),
        message=f"Eliminación manual del respaldo {artifact.name} encolada para backup-worker.",
        payload_json=_json_dumps(payload),
    )
    db.add(operation)
    _create_audit_event(
        db,
        event_type="backup_manual_delete_requested",
        actor_snapshot=actor_snapshot,
        operation_id=operation_id,
        artifact_id=artifact.id,
        details={
            "jobId": job_id,
            "artifactId": artifact.id,
            "scope": artifact.scope,
            "name": artifact.name,
            "isLastAvailableScope": is_last_available_scope,
        },
    )
    db.commit()

    try:
        await _enqueue_backup_job(action, payload, job_id=job_id)
    except Exception as exc:
        _mark_operation_enqueue_failed(
            db,
            operation_id=operation_id,
            actor_snapshot=actor_snapshot,
            error=exc,
        )
        raise

    return {
        "operation_id": operation_id,
        "job_id": job_id,
        "action": action,
        "scope": artifact.scope,
        "status": "queued",
        "queued_at": queued_at,
        "message": f"Eliminación manual de {artifact.name} encolada correctamente.",
    }


async def run_system_backup_artifact_restore(
    db: Session,
    *,
    artifact_id: str,
    session: UserSession,
) -> dict:
    actor_snapshot = _actor_snapshot_from_session(db, session)
    reconcile_system_backup_artifacts(db)
    artifact = (
        db.query(SystemBackupArtifact)
        .filter(SystemBackupArtifact.id == str(artifact_id))
        .filter(SystemBackupArtifact.deleted_at.is_(None))
        .first()
    )
    if not artifact:
        raise NotFoundException("El respaldo solicitado no existe en el catálogo.")
    if artifact.status != "available":
        raise BadRequestException("Solo se pueden restaurar respaldos disponibles.")

    inspection = inspect_system_backup_artifact(db, artifact_id=str(artifact.id))
    if not inspection.get("is_valid"):
        raise BadRequestException("El respaldo no pasó la inspección de integridad.")
    if inspection.get("package_sha256_matches_catalog") is False:
        raise BadRequestException("El SHA-256 del paquete no coincide con el catálogo.")

    metadata = inspection.get("metadata") if isinstance(inspection.get("metadata"), dict) else {}
    manifest = inspection.get("manifest") if isinstance(inspection.get("manifest"), dict) else {}
    package_scope = str(metadata.get("scope") or artifact.scope or "").strip()
    if package_scope not in BACKUP_SCOPES:
        raise BadRequestException("El paquete no declara un tipo de respaldo soportado.")
    if package_scope != artifact.scope:
        raise BadRequestException("El tipo del paquete no coincide con el catálogo.")
    if str(metadata.get("formatVersion") or "") != "1.0":
        raise BadRequestException("La versión de formato del paquete no es compatible.")

    current_app_version = settings.app_version or settings.env_name
    package_app_version = str(metadata.get("appVersion") or "").strip()
    if package_app_version and current_app_version and package_app_version != current_app_version:
        raise BadRequestException("La versión de aplicación del paquete no coincide con la aplicación actual.")

    sections = manifest.get("sections") if isinstance(manifest.get("sections"), dict) else {}
    database_enabled = bool((sections.get("database") or {}).get("enabled"))
    if database_enabled:
        package_db_schema_version = str(metadata.get("dbSchemaVersion") or "").strip()
        current_db_schema_version = get_db_schema_version()
        if package_db_schema_version != current_db_schema_version:
            raise BadRequestException("La versión de esquema de BD del paquete no coincide con la aplicación actual.")
    else:
        current_db_schema_version = get_db_schema_version()

    package_path = Path(str(artifact.file_path or artifact.storage_path or "")).resolve(strict=False)
    backup_root = Path(BACKUP_STORAGE_ROOT).resolve(strict=False)
    if not package_path.is_file():
        raise NotFoundException("El archivo físico del respaldo no existe.")
    try:
        package_path.relative_to(backup_root)
    except ValueError:
        raise BadRequestException("La ruta del respaldo está fuera del directorio permitido.")

    now = utc_now()
    queued_at = now.isoformat()
    operation_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    action = "restore_backup"
    payload = {
        "operation_id": operation_id,
        "scope": package_scope,
        "trigger_source": "manual_restore",
        "requested_by_id": session.user_id,
        "requested_by_snapshot": actor_snapshot,
        "queued_at": queued_at,
        "job_id": job_id,
        "artifact_id": artifact.id,
        "artifact_name": artifact.name,
        "artifact_scope": artifact.scope,
        "artifact_checksum_sha256": artifact.checksum_sha256,
        "artifact_size_bytes": int(artifact.size_bytes or 0),
        "package_path": str(package_path),
        "storage_path": artifact.storage_path,
        "file_path": artifact.file_path,
        "metadata": metadata,
        "manifest": manifest,
        "app_version": current_app_version,
        "db_schema_version": current_db_schema_version,
        "backup_storage_root": BACKUP_STORAGE_ROOT,
    }

    operation = SystemBackupOperation(
        id=operation_id,
        operation_type=action,
        scope=package_scope,
        status="queued",
        trigger_source="manual_restore",
        job_id=job_id,
        artifact_id=artifact.id,
        requested_at=now.replace(tzinfo=None),
        requested_by=session.user_id,
        requested_by_snapshot_json=_json_dumps(actor_snapshot),
        message=f"Restauración de {artifact.name} encolada para backup-worker.",
        payload_json=_json_dumps(payload),
    )
    db.add(operation)
    _create_audit_event(
        db,
        event_type="backup_restore_requested",
        actor_snapshot=actor_snapshot,
        operation_id=operation_id,
        artifact_id=artifact.id,
        details={
            "jobId": job_id,
            "artifactId": artifact.id,
            "scope": package_scope,
            "name": artifact.name,
            "packageSha256": inspection.get("package_sha256"),
            "databaseEnabled": database_enabled,
            "objectsEnabled": bool((sections.get("objects") or {}).get("enabled")),
        },
    )
    db.commit()

    try:
        await _enqueue_backup_job(action, payload, job_id=job_id)
    except Exception as exc:
        _mark_operation_enqueue_failed(
            db,
            operation_id=operation_id,
            actor_snapshot=actor_snapshot,
            error=exc,
        )
        raise

    await publish_backup_event(
        status="queued",
        scope=package_scope,
        action=action,
        message=f"Restauración de {artifact.name} encolada correctamente.",
        trigger="manual_restore",
        operation_id=operation_id,
        job_id=job_id,
        artifact_id=artifact.id,
        actor_user_id=session.user_id,
        metadata={"name": artifact.name, "sizeBytes": int(artifact.size_bytes or 0)},
    )

    return {
        "operation_id": operation_id,
        "job_id": job_id,
        "action": action,
        "scope": package_scope,
        "status": "queued",
        "queued_at": queued_at,
        "message": f"Restauración de {artifact.name} encolada correctamente.",
    }

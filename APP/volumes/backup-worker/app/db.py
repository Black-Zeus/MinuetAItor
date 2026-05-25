from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from core.config import settings


def _sql_quote(value: Any) -> str:
    if value is None:
        return "NULL"
    text = str(value)
    return "'" + text.replace("\\", "\\\\").replace("'", "''") + "'"


def _mariadb_env() -> dict[str, str]:
    env = os.environ.copy()
    env["MYSQL_PWD"] = settings.mariadb_password
    return env


def run_sql(statement: str) -> None:
    command = [
        "mariadb",
        "--batch",
        "--skip-column-names",
        "--host",
        settings.mariadb_host,
        "--port",
        str(settings.mariadb_port),
        "--user",
        settings.mariadb_user,
        settings.mariadb_database,
        "--execute",
        statement,
    ]
    subprocess.run(
        command,
        check=True,
        env=_mariadb_env(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def fetch_sql(statement: str) -> list[list[str]]:
    command = [
        "mariadb",
        "--batch",
        "--skip-column-names",
        "--host",
        settings.mariadb_host,
        "--port",
        str(settings.mariadb_port),
        "--user",
        settings.mariadb_user,
        settings.mariadb_database,
        "--execute",
        statement,
    ]
    result = subprocess.run(
        command,
        check=True,
        env=_mariadb_env(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    rows: list[list[str]] = []
    for line in result.stdout.splitlines():
        if line.strip():
            rows.append(line.split("\t"))
    return rows


def _identifier_quote(value: str) -> str:
    return "`" + str(value).replace("`", "``") + "`"


def table_exists(table_name: str) -> bool:
    rows = fetch_sql(
        "SELECT COUNT(*) FROM information_schema.TABLES "
        f"WHERE TABLE_SCHEMA={_sql_quote(settings.mariadb_database)} "
        f"AND TABLE_NAME={_sql_quote(table_name)}"
    )
    return bool(rows and rows[0] and int(rows[0][0] or 0) > 0)


def list_base_tables() -> list[str]:
    rows = fetch_sql(
        "SELECT TABLE_NAME FROM information_schema.TABLES "
        f"WHERE TABLE_SCHEMA={_sql_quote(settings.mariadb_database)} "
        "AND TABLE_TYPE='BASE TABLE' "
        "ORDER BY TABLE_NAME"
    )
    return [row[0] for row in rows if row]


def truncate_all_base_tables() -> list[str]:
    tables = list_base_tables()
    if not tables:
        return []
    statements = ["SET FOREIGN_KEY_CHECKS=0"]
    statements.extend(f"TRUNCATE TABLE {_identifier_quote(table)}" for table in tables)
    statements.append("SET FOREIGN_KEY_CHECKS=1")
    run_sql("; ".join(statements))
    return tables


def import_gzip_sql_file(path: Path) -> None:
    command = [
        "mariadb",
        "--host",
        settings.mariadb_host,
        "--port",
        str(settings.mariadb_port),
        "--user",
        settings.mariadb_user,
        "--default-character-set=utf8mb4",
        settings.mariadb_database,
    ]
    gzip_process = subprocess.Popen(
        ["gzip", "-dc", str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert gzip_process.stdout is not None
    mariadb_process = subprocess.Popen(
        command,
        stdin=gzip_process.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=_mariadb_env(),
    )
    gzip_process.stdout.close()
    _, mariadb_stderr = mariadb_process.communicate()
    _, gzip_stderr = gzip_process.communicate()
    if gzip_process.returncode != 0:
        raise RuntimeError(gzip_stderr.decode("utf-8", errors="replace")[-4000:])
    if mariadb_process.returncode != 0:
        raise RuntimeError(mariadb_stderr.decode("utf-8", errors="replace")[-4000:])


def clear_runtime_sessions() -> dict[str, Any]:
    cleared_tables: list[str] = []
    for table_name in ("user_sessions", "auth_sessions"):
        if table_exists(table_name):
            run_sql(f"DELETE FROM {_identifier_quote(table_name)}")
            cleared_tables.append(table_name)
    if table_exists("system_operation_state"):
        run_sql(
            "UPDATE system_operation_state "
            "SET mode='normal', operation_id=NULL, operation_type=NULL, reason=NULL, "
            "started_by=NULL, started_by_snapshot_json=NULL, allowed_session_jti=NULL, "
            "started_at=NULL, expires_at=NULL, metadata_json=NULL, updated_at=UTC_TIMESTAMP() "
            "WHERE id=1"
        )
    return {"clearedSessionTables": cleared_tables}


def update_operation_running(operation_id: str, message: str) -> None:
    run_sql(
        "UPDATE system_backup_operations "
        "SET status='running', started_at=COALESCE(started_at, UTC_TIMESTAMP()), "
        f"message={_sql_quote(message)} "
        f"WHERE id={_sql_quote(operation_id)}"
    )


def update_operation_failed(operation_id: str, message: str, error_message: str) -> None:
    run_sql(
        "UPDATE system_backup_operations "
        "SET status='failed', finished_at=UTC_TIMESTAMP(), "
        f"message={_sql_quote(message)}, error_message={_sql_quote(error_message[:8000])} "
        f"WHERE id={_sql_quote(operation_id)}"
    )


def complete_operation(
    *,
    operation_id: str,
    artifact_id: str,
    message: str,
    result: dict[str, Any],
) -> None:
    run_sql(
        "UPDATE system_backup_operations "
        "SET status='completed', finished_at=UTC_TIMESTAMP(), "
        f"artifact_id={_sql_quote(artifact_id)}, "
        f"message={_sql_quote(message)}, "
        f"result_json={_sql_quote(json.dumps(result, ensure_ascii=False, sort_keys=True))} "
        f"WHERE id={_sql_quote(operation_id)}"
    )


def complete_operation_without_artifact(
    *,
    operation_id: str,
    message: str,
    result: dict[str, Any],
) -> None:
    run_sql(
        "UPDATE system_backup_operations "
        "SET status='completed', finished_at=UTC_TIMESTAMP(), "
        f"message={_sql_quote(message)}, "
        f"result_json={_sql_quote(json.dumps(result, ensure_ascii=False, sort_keys=True))} "
        f"WHERE id={_sql_quote(operation_id)}"
    )


def upsert_operation_completed_without_artifact(
    *,
    operation_id: str,
    operation_type: str,
    scope: str,
    trigger_source: str,
    job_id: str | None,
    artifact_id: str | None,
    requested_by: str | None,
    requested_by_snapshot: dict[str, Any] | None,
    payload: dict[str, Any],
    message: str,
    result: dict[str, Any],
) -> None:
    run_sql(
        "INSERT INTO system_backup_operations ("
        "id, operation_type, scope, status, trigger_source, job_id, artifact_id, "
        "requested_at, requested_by, requested_by_snapshot_json, started_at, finished_at, "
        "message, payload_json, result_json"
        ") VALUES ("
        f"{_sql_quote(operation_id)}, "
        f"{_sql_quote(operation_type)}, "
        f"{_sql_quote(scope)}, "
        "'completed', "
        f"{_sql_quote(trigger_source)}, "
        f"{_sql_quote(job_id)}, "
        f"{_sql_quote(artifact_id)}, "
        "UTC_TIMESTAMP(), "
        f"{_sql_quote(requested_by)}, "
        f"{_sql_quote(json.dumps(requested_by_snapshot, ensure_ascii=False, sort_keys=True) if requested_by_snapshot else None)}, "
        "UTC_TIMESTAMP(), "
        "UTC_TIMESTAMP(), "
        f"{_sql_quote(message)}, "
        f"{_sql_quote(json.dumps(payload, ensure_ascii=False, sort_keys=True))}, "
        f"{_sql_quote(json.dumps(result, ensure_ascii=False, sort_keys=True))}"
        ") ON DUPLICATE KEY UPDATE "
        "status='completed', finished_at=UTC_TIMESTAMP(), "
        f"artifact_id={_sql_quote(artifact_id)}, "
        f"message={_sql_quote(message)}, "
        f"result_json={_sql_quote(json.dumps(result, ensure_ascii=False, sort_keys=True))}"
    )


def upsert_operation_failed(
    *,
    operation_id: str,
    operation_type: str,
    scope: str,
    trigger_source: str,
    job_id: str | None,
    artifact_id: str | None,
    requested_by: str | None,
    requested_by_snapshot: dict[str, Any] | None,
    payload: dict[str, Any],
    message: str,
    error_message: str,
) -> None:
    run_sql(
        "INSERT INTO system_backup_operations ("
        "id, operation_type, scope, status, trigger_source, job_id, artifact_id, "
        "requested_at, requested_by, requested_by_snapshot_json, started_at, finished_at, "
        "message, error_message, payload_json"
        ") VALUES ("
        f"{_sql_quote(operation_id)}, "
        f"{_sql_quote(operation_type)}, "
        f"{_sql_quote(scope)}, "
        "'failed', "
        f"{_sql_quote(trigger_source)}, "
        f"{_sql_quote(job_id)}, "
        f"{_sql_quote(artifact_id)}, "
        "UTC_TIMESTAMP(), "
        f"{_sql_quote(requested_by)}, "
        f"{_sql_quote(json.dumps(requested_by_snapshot, ensure_ascii=False, sort_keys=True) if requested_by_snapshot else None)}, "
        "UTC_TIMESTAMP(), "
        "UTC_TIMESTAMP(), "
        f"{_sql_quote(message)}, "
        f"{_sql_quote(error_message[:8000])}, "
        f"{_sql_quote(json.dumps(payload, ensure_ascii=False, sort_keys=True))}"
        ") ON DUPLICATE KEY UPDATE "
        "status='failed', finished_at=UTC_TIMESTAMP(), "
        f"artifact_id={_sql_quote(artifact_id)}, "
        f"message={_sql_quote(message)}, "
        f"error_message={_sql_quote(error_message[:8000])}"
    )


def mark_artifact_purged(
    *,
    artifact_id: str,
    deleted_by: str | None,
    deleted_by_snapshot: dict[str, Any] | None,
) -> None:
    run_sql(
        "UPDATE system_backup_artifacts "
        "SET status='purged', deleted_at=UTC_TIMESTAMP(), updated_at=UTC_TIMESTAMP(), "
        f"deleted_by={_sql_quote(deleted_by)}, "
        f"deleted_by_snapshot_json={_sql_quote(json.dumps(deleted_by_snapshot, ensure_ascii=False, sort_keys=True) if deleted_by_snapshot else None)} "
        f"WHERE id={_sql_quote(artifact_id)} AND deleted_at IS NULL"
    )


def insert_artifact(
    *,
    artifact_id: str,
    scope: str,
    name: str,
    status: str,
    origin_type: str,
    storage_path: str,
    file_path: str,
    size_bytes: int,
    checksum_sha256: str,
    db_schema_version: str | None,
    app_version: str | None,
    metadata: dict[str, Any],
    manifest: dict[str, Any],
    created_by: str | None,
    created_by_snapshot: dict[str, Any] | None,
) -> None:
    run_sql(
        "INSERT INTO system_backup_artifacts ("
        "id, scope, name, status, origin_type, storage_path, file_path, size_bytes, "
        "checksum_sha256, db_schema_version, app_version, metadata_json, manifest_json, "
        "created_at, updated_at, created_by, created_by_snapshot_json"
        ") VALUES ("
        f"{_sql_quote(artifact_id)}, "
        f"{_sql_quote(scope)}, "
        f"{_sql_quote(name)}, "
        f"{_sql_quote(status)}, "
        f"{_sql_quote(origin_type)}, "
        f"{_sql_quote(storage_path)}, "
        f"{_sql_quote(file_path)}, "
        f"{int(size_bytes)}, "
        f"{_sql_quote(checksum_sha256)}, "
        f"{_sql_quote(db_schema_version)}, "
        f"{_sql_quote(app_version)}, "
        f"{_sql_quote(json.dumps(metadata, ensure_ascii=False, sort_keys=True))}, "
        f"{_sql_quote(json.dumps(manifest, ensure_ascii=False, sort_keys=True))}, "
        "UTC_TIMESTAMP(), "
        "UTC_TIMESTAMP(), "
        f"{_sql_quote(created_by)}, "
        f"{_sql_quote(json.dumps(created_by_snapshot, ensure_ascii=False, sort_keys=True) if created_by_snapshot else None)}"
        ")"
    )


def upsert_artifact(
    *,
    artifact_id: str,
    scope: str,
    name: str,
    status: str,
    origin_type: str,
    storage_path: str,
    file_path: str,
    size_bytes: int,
    checksum_sha256: str,
    db_schema_version: str | None,
    app_version: str | None,
    metadata: dict[str, Any],
    manifest: dict[str, Any],
    created_by: str | None,
    created_by_snapshot: dict[str, Any] | None,
) -> None:
    run_sql(
        "INSERT INTO system_backup_artifacts ("
        "id, scope, name, status, origin_type, storage_path, file_path, size_bytes, "
        "checksum_sha256, db_schema_version, app_version, metadata_json, manifest_json, "
        "created_at, updated_at, created_by, created_by_snapshot_json"
        ") VALUES ("
        f"{_sql_quote(artifact_id)}, "
        f"{_sql_quote(scope)}, "
        f"{_sql_quote(name)}, "
        f"{_sql_quote(status)}, "
        f"{_sql_quote(origin_type)}, "
        f"{_sql_quote(storage_path)}, "
        f"{_sql_quote(file_path)}, "
        f"{int(size_bytes)}, "
        f"{_sql_quote(checksum_sha256)}, "
        f"{_sql_quote(db_schema_version)}, "
        f"{_sql_quote(app_version)}, "
        f"{_sql_quote(json.dumps(metadata, ensure_ascii=False, sort_keys=True))}, "
        f"{_sql_quote(json.dumps(manifest, ensure_ascii=False, sort_keys=True))}, "
        "UTC_TIMESTAMP(), "
        "UTC_TIMESTAMP(), "
        f"{_sql_quote(created_by)}, "
        f"{_sql_quote(json.dumps(created_by_snapshot, ensure_ascii=False, sort_keys=True) if created_by_snapshot else None)}"
        ") ON DUPLICATE KEY UPDATE "
        f"scope={_sql_quote(scope)}, "
        f"name={_sql_quote(name)}, "
        f"status={_sql_quote(status)}, "
        f"origin_type={_sql_quote(origin_type)}, "
        f"storage_path={_sql_quote(storage_path)}, "
        f"file_path={_sql_quote(file_path)}, "
        f"size_bytes={int(size_bytes)}, "
        f"checksum_sha256={_sql_quote(checksum_sha256)}, "
        f"db_schema_version={_sql_quote(db_schema_version)}, "
        f"app_version={_sql_quote(app_version)}, "
        f"metadata_json={_sql_quote(json.dumps(metadata, ensure_ascii=False, sort_keys=True))}, "
        f"manifest_json={_sql_quote(json.dumps(manifest, ensure_ascii=False, sort_keys=True))}, "
        "updated_at=UTC_TIMESTAMP(), deleted_at=NULL, deleted_by=NULL, deleted_by_snapshot_json=NULL"
    )


def insert_audit_event(
    *,
    event_type: str,
    operation_id: str | None,
    artifact_id: str | None,
    actor_snapshot: dict[str, Any] | None,
    details: dict[str, Any],
) -> None:
    actor_user_id = None
    if actor_snapshot:
        actor_user_id = actor_snapshot.get("user_id") or actor_snapshot.get("userId")
    run_sql(
        "INSERT INTO system_backup_audit_events ("
        "event_at, event_type, operation_id, artifact_id, actor_user_id, "
        "actor_snapshot_json, details_json"
        ") VALUES ("
        "UTC_TIMESTAMP(), "
        f"{_sql_quote(event_type)}, "
        f"{_sql_quote(operation_id)}, "
        f"{_sql_quote(artifact_id)}, "
        f"{_sql_quote(actor_user_id)}, "
        f"{_sql_quote(json.dumps(actor_snapshot, ensure_ascii=False, sort_keys=True) if actor_snapshot else None)}, "
        f"{_sql_quote(json.dumps(details, ensure_ascii=False, sort_keys=True))}"
        ")"
    )

from __future__ import annotations

import gzip
import hashlib
import json
import os
import shutil
import subprocess
import tarfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from core.config import settings


PACKAGE_FORMAT_VERSION = "1.0"
SYSTEM_MINIO_BUCKETS = (
    "minuetaitor-inputs",
    "minuetaitor-json",
    "minuetaitor-published",
    "minuetaitor-attach",
    "minuetaitor-draft",
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_compact_timestamp(value: datetime | None = None) -> str:
    current = value or utc_now()
    return current.strftime("%Y%m%dT%H%M%SZ")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _mariadb_env() -> dict[str, str]:
    env = os.environ.copy()
    env["MYSQL_PWD"] = settings.mariadb_password
    return env


def minio_alias_name() -> str:
    return "minuetaitor"


def minio_endpoint_url() -> str:
    scheme = "https" if settings.minio_secure else "http"
    return f"{scheme}://{settings.minio_host}:{settings.minio_port}"


def run_command(command: list[str]) -> None:
    subprocess.run(
        command,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def ensure_minio_alias() -> None:
    run_command(
        [
            "mc",
            "alias",
            "set",
            minio_alias_name(),
            minio_endpoint_url(),
            settings.minio_root_user,
            settings.minio_root_password,
        ]
    )


def mirror_minio_bucket(bucket: str, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    run_command(
        [
            "mc",
            "mirror",
            "--overwrite",
            f"{minio_alias_name()}/{bucket}",
            str(destination),
        ]
    )


def ensure_minio_bucket(bucket: str) -> None:
    ensure_minio_alias()
    run_command(["mc", "mb", "--ignore-existing", f"{minio_alias_name()}/{bucket}"])


def clear_minio_bucket(bucket: str) -> None:
    ensure_minio_alias()
    run_command(["mc", "rm", "--recursive", "--force", f"{minio_alias_name()}/{bucket}"])


def _safe_extract_tar(archive_path: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    with tarfile.open(archive_path, "r:gz") as archive:
        for member in archive.getmembers():
            target = (destination / member.name).resolve(strict=False)
            if target != root and root not in target.parents:
                raise ValueError(f"Ruta insegura dentro del archivo MinIO: {member.name}")
        archive.extractall(destination)


def restore_minio_bucket_archive(bucket: str, archive_path: Path, work_dir: Path) -> dict[str, Any]:
    restore_dir = work_dir / "minio-restore" / bucket
    if restore_dir.exists():
        shutil.rmtree(restore_dir)
    _safe_extract_tar(archive_path, restore_dir)
    object_count, object_bytes = count_tree_files(restore_dir)
    ensure_minio_bucket(bucket)
    clear_minio_bucket(bucket)
    run_command(["mc", "mirror", "--overwrite", str(restore_dir), f"{minio_alias_name()}/{bucket}"])
    return {
        "bucket": bucket,
        "objectCount": object_count,
        "sourceBytes": object_bytes,
    }


def make_bucket_archive(source_dir: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output_path, "w:gz", compresslevel=6) as archive:
        for child in sorted(source_dir.rglob("*")):
            if child.is_file():
                archive.add(child, arcname=child.relative_to(source_dir))


def count_tree_files(path: Path) -> tuple[int, int]:
    count = 0
    size = 0
    for child in path.rglob("*"):
        if child.is_file():
            count += 1
            size += child.stat().st_size
    return count, size


def dump_mariadb_data(output_path: Path) -> None:
    command = [
        "mariadb-dump",
        "--host",
        settings.mariadb_host,
        "--port",
        str(settings.mariadb_port),
        "--user",
        settings.mariadb_user,
        "--single-transaction",
        "--quick",
        "--skip-lock-tables",
        "--skip-add-locks",
        "--skip-comments",
        "--no-create-info",
        "--complete-insert",
        "--default-character-set=utf8mb4",
        settings.mariadb_database,
    ]
    with output_path.open("wb") as raw_fh:
        with gzip.GzipFile(fileobj=raw_fh, mode="wb", mtime=0) as gzip_fh:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=_mariadb_env(),
            )
            assert process.stdout is not None
            shutil.copyfileobj(process.stdout, gzip_fh)
            _, stderr = process.communicate()
            if process.returncode != 0:
                raise RuntimeError(stderr.decode("utf-8", errors="replace")[-4000:])


def build_checksums(package_dir: Path, relative_paths: list[str]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for relative_path in relative_paths:
        path = package_dir / relative_path
        entries.append(
            {
                "path": relative_path,
                "sha256": sha256_file(path),
                "sizeBytes": path.stat().st_size,
            }
        )
    return entries


def write_checksums(path: Path, checksums: list[dict[str, Any]]) -> None:
    lines = [f"{entry['sha256']}  {entry['path']}" for entry in checksums]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def make_package_archive(package_dir: Path, output_path: Path) -> None:
    with tarfile.open(output_path, "w:gz", compresslevel=6) as archive:
        for child in sorted(package_dir.rglob("*")):
            if child.is_file():
                archive.add(child, arcname=child.relative_to(package_dir))


def prepare_package_dirs(backup_root: Path, job_id: str, scope: str) -> tuple[Path, Path, Path]:
    work_root = backup_root / ".work" / job_id
    package_dir = work_root / "package"
    output_dir = backup_root / scope
    if work_root.exists():
        shutil.rmtree(work_root)
    package_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    return work_root, package_dir, output_dir


def archive_minio_buckets(
    *,
    work_root: Path,
    package_dir: Path,
    buckets: tuple[str, ...] = SYSTEM_MINIO_BUCKETS,
) -> tuple[list[dict[str, Any]], list[str]]:
    mirror_root = work_root / "minio-mirror"
    mirror_root.mkdir(parents=True, exist_ok=True)
    ensure_minio_alias()

    bucket_entries: list[dict[str, Any]] = []
    data_relative_paths: list[str] = []
    for bucket in buckets:
        bucket_mirror_dir = mirror_root / bucket
        mirror_minio_bucket(bucket, bucket_mirror_dir)
        object_count, object_bytes = count_tree_files(bucket_mirror_dir)
        relative_path = f"minio/{bucket}/data.bucket.tar.gz"
        archive_path = package_dir / relative_path
        make_bucket_archive(bucket_mirror_dir, archive_path)
        bucket_entries.append(
            {
                "name": bucket,
                "path": relative_path,
                "format": "tar_gzip",
                "objectCount": object_count,
                "sourceBytes": object_bytes,
                "archiveBytes": archive_path.stat().st_size,
            }
        )
        data_relative_paths.append(relative_path)
    return bucket_entries, data_relative_paths


def finalize_package(
    *,
    package_dir: Path,
    output_path: Path,
    metadata: dict[str, Any],
    manifest: dict[str, Any],
    data_relative_paths: list[str],
) -> tuple[str, int]:
    write_json(package_dir / "metadata.json", metadata)
    write_json(package_dir / "manifest.json", manifest)
    checksums = build_checksums(package_dir, ["metadata.json", "manifest.json", *data_relative_paths])
    write_checksums(package_dir / "checksums.sha256", checksums)
    manifest["files"] = checksums
    write_json(package_dir / "manifest.json", manifest)
    checksums = build_checksums(package_dir, ["metadata.json", "manifest.json", *data_relative_paths])
    write_checksums(package_dir / "checksums.sha256", checksums)

    make_package_archive(package_dir, output_path)
    return sha256_file(output_path), output_path.stat().st_size


def build_database_backup_package(
    *,
    job_id: str,
    operation_id: str,
    scope: str,
    trigger_source: str,
    actor_snapshot: dict[str, Any] | None,
    db_schema_version: str | None,
    app_version: str | None,
    policy: dict[str, Any],
    backup_root: Path,
) -> dict[str, Any]:
    timestamp = utc_compact_timestamp()
    artifact_id = str(uuid.uuid4())
    package_name = f"backup-{scope}-{timestamp}.tar.gz"
    work_root, package_dir, output_dir = prepare_package_dirs(backup_root, job_id, scope)
    output_path = output_dir / package_name
    (package_dir / "mariadb").mkdir(parents=True, exist_ok=True)

    data_path = package_dir / "mariadb" / "data.sql.gz"
    dump_mariadb_data(data_path)

    files = build_checksums(package_dir, ["mariadb/data.sql.gz"])
    metadata = {
        "formatVersion": PACKAGE_FORMAT_VERSION,
        "artifactId": artifact_id,
        "operationId": operation_id,
        "jobId": job_id,
        "scope": scope,
        "createdAt": utc_now().isoformat(),
        "triggerSource": trigger_source,
        "appVersion": app_version,
        "dbSchemaVersion": db_schema_version,
        "database": {
            "engine": "mariadb",
            "name": settings.mariadb_database,
            "mode": "data_only",
        },
        "objects": None,
        "actor": actor_snapshot,
        "policy": policy,
    }
    manifest = {
        "formatVersion": PACKAGE_FORMAT_VERSION,
        "scope": scope,
        "sections": {
            "database": {
                "enabled": True,
                "path": "mariadb/data.sql.gz",
                "format": "sql_gzip",
                "dataOnly": True,
            },
            "objects": {
                "enabled": False,
                "buckets": [],
            },
        },
        "files": files,
    }
    package_checksum, package_size = finalize_package(
        package_dir=package_dir,
        output_path=output_path,
        metadata=metadata,
        manifest=manifest,
        data_relative_paths=["mariadb/data.sql.gz"],
    )

    shutil.rmtree(work_root, ignore_errors=True)

    return {
        "artifactId": artifact_id,
        "name": package_name,
        "storagePath": str(output_path),
        "filePath": str(output_path),
        "sizeBytes": package_size,
        "checksumSha256": package_checksum,
        "metadata": metadata,
        "manifest": manifest,
    }


def build_objects_backup_package(
    *,
    job_id: str,
    operation_id: str,
    scope: str,
    trigger_source: str,
    actor_snapshot: dict[str, Any] | None,
    db_schema_version: str | None,
    app_version: str | None,
    policy: dict[str, Any],
    backup_root: Path,
    buckets: tuple[str, ...] = SYSTEM_MINIO_BUCKETS,
) -> dict[str, Any]:
    timestamp = utc_compact_timestamp()
    artifact_id = str(uuid.uuid4())
    package_name = f"backup-{scope}-{timestamp}.tar.gz"
    work_root, package_dir, output_dir = prepare_package_dirs(backup_root, job_id, scope)
    output_path = output_dir / package_name
    bucket_entries, data_relative_paths = archive_minio_buckets(
        work_root=work_root,
        package_dir=package_dir,
        buckets=buckets,
    )

    metadata = {
        "formatVersion": PACKAGE_FORMAT_VERSION,
        "artifactId": artifact_id,
        "operationId": operation_id,
        "jobId": job_id,
        "scope": scope,
        "createdAt": utc_now().isoformat(),
        "triggerSource": trigger_source,
        "appVersion": app_version,
        "dbSchemaVersion": db_schema_version,
        "database": None,
        "objects": {
            "engine": "minio",
            "endpoint": f"{settings.minio_host}:{settings.minio_port}",
            "buckets": list(buckets),
        },
        "actor": actor_snapshot,
        "policy": policy,
    }
    manifest = {
        "formatVersion": PACKAGE_FORMAT_VERSION,
        "scope": scope,
        "sections": {
            "database": {
                "enabled": False,
                "path": None,
                "format": None,
                "dataOnly": True,
            },
            "objects": {
                "enabled": True,
                "buckets": bucket_entries,
            },
        },
        "files": build_checksums(package_dir, data_relative_paths),
    }
    package_checksum, package_size = finalize_package(
        package_dir=package_dir,
        output_path=output_path,
        metadata=metadata,
        manifest=manifest,
        data_relative_paths=data_relative_paths,
    )

    shutil.rmtree(work_root, ignore_errors=True)

    return {
        "artifactId": artifact_id,
        "name": package_name,
        "storagePath": str(output_path),
        "filePath": str(output_path),
        "sizeBytes": package_size,
        "checksumSha256": package_checksum,
        "metadata": metadata,
        "manifest": manifest,
    }


def build_full_backup_package(
    *,
    job_id: str,
    operation_id: str,
    scope: str,
    trigger_source: str,
    actor_snapshot: dict[str, Any] | None,
    db_schema_version: str | None,
    app_version: str | None,
    policy: dict[str, Any],
    backup_root: Path,
    buckets: tuple[str, ...] = SYSTEM_MINIO_BUCKETS,
) -> dict[str, Any]:
    timestamp = utc_compact_timestamp()
    artifact_id = str(uuid.uuid4())
    package_name = f"backup-{scope}-{timestamp}.tar.gz"
    work_root, package_dir, output_dir = prepare_package_dirs(backup_root, job_id, scope)
    output_path = output_dir / package_name
    (package_dir / "mariadb").mkdir(parents=True, exist_ok=True)

    database_relative_path = "mariadb/data.sql.gz"
    dump_mariadb_data(package_dir / database_relative_path)
    bucket_entries, object_relative_paths = archive_minio_buckets(
        work_root=work_root,
        package_dir=package_dir,
        buckets=buckets,
    )
    data_relative_paths = [database_relative_path, *object_relative_paths]

    metadata = {
        "formatVersion": PACKAGE_FORMAT_VERSION,
        "artifactId": artifact_id,
        "operationId": operation_id,
        "jobId": job_id,
        "scope": scope,
        "createdAt": utc_now().isoformat(),
        "triggerSource": trigger_source,
        "appVersion": app_version,
        "dbSchemaVersion": db_schema_version,
        "database": {
            "engine": "mariadb",
            "name": settings.mariadb_database,
            "mode": "data_only",
        },
        "objects": {
            "engine": "minio",
            "endpoint": f"{settings.minio_host}:{settings.minio_port}",
            "buckets": list(buckets),
        },
        "actor": actor_snapshot,
        "policy": policy,
    }
    manifest = {
        "formatVersion": PACKAGE_FORMAT_VERSION,
        "scope": scope,
        "sections": {
            "database": {
                "enabled": True,
                "path": database_relative_path,
                "format": "sql_gzip",
                "dataOnly": True,
            },
            "objects": {
                "enabled": True,
                "buckets": bucket_entries,
            },
        },
        "files": build_checksums(package_dir, data_relative_paths),
    }
    package_checksum, package_size = finalize_package(
        package_dir=package_dir,
        output_path=output_path,
        metadata=metadata,
        manifest=manifest,
        data_relative_paths=data_relative_paths,
    )

    shutil.rmtree(work_root, ignore_errors=True)

    return {
        "artifactId": artifact_id,
        "name": package_name,
        "storagePath": str(output_path),
        "filePath": str(output_path),
        "sizeBytes": package_size,
        "checksumSha256": package_checksum,
        "metadata": metadata,
        "manifest": manifest,
    }

from __future__ import annotations

import os
from dataclasses import dataclass


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _float_env(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    env_name: str = os.environ.get("ENV_NAME", "dev")
    app_version: str = os.environ.get("APP_VERSION", "")
    log_level: str = os.environ.get("LOG_LEVEL", "INFO")

    redis_host: str = os.environ.get("REDIS_HOST", "redis")
    redis_port: int = _int_env("REDIS_PORT", 6379)
    redis_db: int = _int_env("REDIS_DB", 0)
    backup_queue: str = os.environ.get("BACKUP_QUEUE", "queue:backups")
    dlq_queue: str = os.environ.get("BACKUP_DLQ_QUEUE", "queue:backups:dlq")
    blpop_timeout: int = _int_env("BACKUP_BLPOP_TIMEOUT", 5)
    max_concurrent_jobs: int = _int_env("BACKUP_MAX_CONCURRENT", 1)
    max_retries: int = _int_env("BACKUP_MAX_RETRIES", 3)
    retry_backoff_base: float = _float_env("BACKUP_RETRY_BACKOFF", 2.0)

    backup_storage_root: str = os.environ.get("BACKUP_STORAGE_ROOT", "/app/remote_data/backups")
    maintenance_state_file: str = os.environ.get("MAINTENANCE_STATE_FILE", "/app/backend_app/maintenance_state.json")

    mariadb_host: str = os.environ.get("MARIADB_HOST", "mariadb")
    mariadb_port: int = _int_env("MARIADB_PORT", 3306)
    mariadb_database: str = os.environ.get("MARIADB_DATABASE", "minuetaitor")
    mariadb_user: str = os.environ.get("MARIADB_USER", "minuetaitor")
    mariadb_password: str = os.environ.get("MARIADB_PASSWORD", "")

    minio_host: str = os.environ.get("MINIO_HOST", "minio")
    minio_port: int = _int_env("MINIO_PORT", 9000)
    minio_root_user: str = os.environ.get("MINIO_ROOT_USER", "minioadmin")
    minio_root_password: str = os.environ.get("MINIO_ROOT_PASSWORD", "")
    minio_secure: bool = os.environ.get("MINIO_SECURE", "false").lower() == "true"

    backend_internal_url: str = os.environ.get("BACKEND_INTERNAL_URL", "http://backend:8000")
    internal_api_secret: str = os.environ.get("INTERNAL_API_SECRET", "-")
    backend_timeout: int = _int_env("BACKEND_TIMEOUT", 30)


settings = Settings()

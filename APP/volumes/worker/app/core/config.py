# core/config.py
"""
Configuración central del worker.
Todas las variables de entorno se leen aquí — un solo lugar para cambiarlas.
"""
import os
from pathlib import Path


def _env_or_file(name: str, default: str = "") -> str:
    file_path = os.environ.get(f"{name}_FILE")
    if file_path:
        try:
            value = Path(file_path).read_text(encoding="utf-8").strip()
            if value:
                return value
        except OSError:
            pass
    return os.environ.get(name, default)


class WorkerConfig:
    # ── Entorno ───────────────────────────────────────────────────────────────
    ENV_NAME: str = os.environ.get("ENV_NAME", "dev")

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_HOST: str = os.environ.get("REDIS_HOST", "redis")
    REDIS_PORT: int = int(os.environ.get("REDIS_PORT", "6379"))
    REDIS_DB:   int = int(os.environ.get("REDIS_DB",   "0"))

    # ── Worker: comportamiento ────────────────────────────────────────────────
    MAX_CONCURRENT_JOBS: int   = int(os.environ.get("WORKER_MAX_CONCURRENT",  "5"))
    MAX_RETRIES:         int   = int(os.environ.get("WORKER_MAX_RETRIES",     "3"))
    RETRY_BACKOFF_BASE:  float = float(os.environ.get("WORKER_RETRY_BACKOFF", "2.0"))
    BLPOP_TIMEOUT:       int   = int(os.environ.get("WORKER_BLPOP_TIMEOUT",   "5"))

    # ── Backend interno ───────────────────────────────────────────────────────
    BACKEND_INTERNAL_URL: str  = os.environ.get("BACKEND_INTERNAL_URL", "http://minuetaitor-backend:8000")
    INTERNAL_API_SECRET:  str  = _env_or_file("INTERNAL_API_SECRET",  "-")
    BACKEND_TIMEOUT:      int  = int(os.environ.get("BACKEND_TIMEOUT",  "30"))

    # ── Trace / Debug ─────────────────────────────────────────────────────────
    TRACE_ENABLED:   bool = os.environ.get("TRACE_ENABLED",   "false").lower() == "true"
    TRACE_BASE_DIR:  str  = os.environ.get("TRACE_BASE_DIR",  "/app/assets/temp")
    PROMPT_PATH_BASE: str = os.environ.get("PROMPT_PATH_BASE", "/app/assets/prompts")
    MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS: str = os.environ.get(
        "MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS",
        "traces/tmp,render/tmp,uploads/tmp,maintenance/tmp",
    )
    MAINTENANCE_TEMP_CLEANUP_DRY_RUN: bool = (
        os.environ.get("MAINTENANCE_TEMP_CLEANUP_DRY_RUN", "false").lower() == "true"
    )
    MAINTENANCE_TEMP_CLEANUP_SAFETY_GRACE_MINUTES: int = int(
        os.environ.get("MAINTENANCE_TEMP_CLEANUP_SAFETY_GRACE_MINUTES", "30")
    )
    MAINTENANCE_TEMP_CLEANUP_ALLOW_TMP_ROOT: bool = (
        os.environ.get("MAINTENANCE_TEMP_CLEANUP_ALLOW_TMP_ROOT", "false").lower() == "true"
    )
    MAINTENANCE_SESSION_CLEANUP_GRACE_MINUTES: int = int(
        os.environ.get("MAINTENANCE_SESSION_CLEANUP_GRACE_MINUTES", "240")
    )
    MAINTENANCE_SESSION_CLEANUP_BATCH_SIZE: int = int(
        os.environ.get("MAINTENANCE_SESSION_CLEANUP_BATCH_SIZE", "500")
    )
    MAINTENANCE_SESSION_CLEANUP_MAX_AFFECTED: int = int(
        os.environ.get("MAINTENANCE_SESSION_CLEANUP_MAX_AFFECTED", "100")
    )

    EMAIL_INLINE_LOGO_PATH: str = os.environ.get(
        "EMAIL_INLINE_LOGO_PATH",
        "/app/assets/images/chinchinAItor_64.jpg",
    )

    # ── MariaDB ───────────────────────────────────────────────────────────────
    MARIADB_HOST:     str = os.environ.get("MARIADB_HOST",     "mariadb")
    MARIADB_PORT:     int = int(os.environ.get("MARIADB_PORT", "3306"))
    MARIADB_DATABASE: str = os.environ.get("MARIADB_DATABASE", "")
    MARIADB_USER:     str = os.environ.get("MARIADB_USER",     "")
    MARIADB_PASSWORD: str = _env_or_file("MARIADB_PASSWORD", "")

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.MARIADB_USER}:{self.MARIADB_PASSWORD}"
            f"@{self.MARIADB_HOST}:{self.MARIADB_PORT}/{self.MARIADB_DATABASE}"
            f"?charset=utf8mb4"
        )

    # ── MinIO ─────────────────────────────────────────────────────────────────
    MINIO_HOST:     str  = os.environ.get("MINIO_HOST",          "minio")
    MINIO_PORT:     int  = int(os.environ.get("MINIO_PORT",      "9000"))
    MINIO_USER:     str  = os.environ.get("MINIO_ROOT_USER",     "")
    MINIO_PASSWORD: str  = _env_or_file("MINIO_ROOT_PASSWORD", "")
    MINIO_SECURE:   bool = os.environ.get("MINIO_SECURE",        "false").lower() == "true"

    @property
    def MINIO_ENDPOINT(self) -> str:
        return f"{self.MINIO_HOST}:{self.MINIO_PORT}"

    # ── IA runtime ────────────────────────────────────────────────────────────
    # Solo el prompt del sistema sigue dependiendo del entorno local.
    AI_MAX_TOKENS: int = 16000
    AI_PROVIDER_TIMEOUT_FALLBACK: int = 120
    OPENAI_SYSTEM_PROMPT: str = os.environ.get("OPENAI_SYSTEM_PROMPT", "system_prompt_v08.txt")

    # MIMEs aceptados para archivos de transcripción
    MINUTES_SUPPORTED_MIMES: dict[str, str] = {
        "text/plain":       "text",
        "application/json": "json",
        "application/pdf":  "pdf",
        "image/png":        "png",
        "image/jpeg":       "jpeg",
    }

    # ── Minutas: rutas internas del contenedor ────────────────────────────────
    PROMPT_PATH_BASE: str = os.environ.get("PROMPT_PATH_BASE", "/app/assets/prompts")
    TRACE_BASE_DIR:   str = os.environ.get("TRACE_BASE_DIR",   "/app/assets/temp")

    # ── Pub/Sub ───────────────────────────────────────────────────────────────
    PUBSUB_MINUTES_CHANNEL: str = "events:minutes"


settings = WorkerConfig()

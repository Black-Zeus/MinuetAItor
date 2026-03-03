# core/config.py
"""
Configuración central del worker.
Todas las variables de entorno se leen aquí — un solo lugar para cambiarlas.
"""
import os


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

    # ── SMTP ──────────────────────────────────────────────────────────────────
    SMTP_HOST:       str  = os.environ.get("SMTP_HOST",       "mailpit")
    SMTP_PORT:       int  = int(os.environ.get("SMTP_PORT",   "1025"))
    SMTP_USER:       str  = os.environ.get("SMTP_USER",       "")
    SMTP_PASSWORD:   str  = os.environ.get("SMTP_PASSWORD",   "")
    SMTP_FROM_NAME:  str  = os.environ.get("SMTP_FROM_NAME",  "MinuetAItor")
    SMTP_FROM_EMAIL: str  = os.environ.get("SMTP_FROM_EMAIL", "no-reply@minuetaitor.cl")
    SMTP_USE_TLS:    bool = os.environ.get("SMTP_USE_TLS",    "false").lower() == "true"
    SMTP_USE_SSL:    bool = os.environ.get("SMTP_USE_SSL",    "false").lower() == "true"
    SMTP_TIMEOUT:    int  = int(os.environ.get("SMTP_TIMEOUT", "10"))

    # ── MariaDB ───────────────────────────────────────────────────────────────
    MARIADB_HOST:     str = os.environ.get("MARIADB_HOST",     "mariadb")
    MARIADB_PORT:     int = int(os.environ.get("MARIADB_PORT", "3306"))
    MARIADB_DATABASE: str = os.environ.get("MARIADB_DATABASE", "")
    MARIADB_USER:     str = os.environ.get("MARIADB_USER",     "")
    MARIADB_PASSWORD: str = os.environ.get("MARIADB_PASSWORD", "")

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
    MINIO_PASSWORD: str  = os.environ.get("MINIO_ROOT_PASSWORD", "")
    MINIO_SECURE:   bool = os.environ.get("MINIO_SECURE",        "false").lower() == "true"

    @property
    def MINIO_ENDPOINT(self) -> str:
        return f"{self.MINIO_HOST}:{self.MINIO_PORT}"

    # ── OpenAI ────────────────────────────────────────────────────────────────
    OPENAI_API_KEY:    str = os.environ.get("OPENAI_API_KEY",         "")
    OPENAI_MODEL:      str = os.environ.get("OPENAI_MODEL",           "gpt-4o")
    OPENAI_MAX_TOKENS: int = int(os.environ.get("OPENAI_MAX_TOKENS",  "16000"))
    OPENAI_TIMEOUT:    int = int(os.environ.get("OPENAI_TIMEOUT_SECONDS", "300"))
    OPENAI_SYSTEM_PROMPT: str = os.environ.get("OPENAI_SYSTEM_PROMPT", "system_prompt_v06")

    # Modelos con soporte de bloques nativos 'type: file' en Chat Completions
    OPENAI_MODELS_WITH_FILE_SUPPORT: list[str] = ["gpt-4o", "gpt-4-turbo"]

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
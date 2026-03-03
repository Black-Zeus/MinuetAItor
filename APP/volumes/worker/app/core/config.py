# core/config.py
"""
Configuración central del worker.
Todas las variables de entorno se leen aquí — un solo lugar para cambiarlas.
"""
import os


class WorkerConfig:
    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_HOST: str = os.environ.get("REDIS_HOST", "redis")
    REDIS_PORT: int = int(os.environ.get("REDIS_PORT", "6379"))
    REDIS_DB:   int = int(os.environ.get("REDIS_DB",   "0"))

    # ── Concurrencia ──────────────────────────────────────────────────────────
    # Máximo de jobs corriendo en paralelo (asyncio tasks)
    MAX_CONCURRENT_JOBS: int = int(os.environ.get("WORKER_MAX_CONCURRENT", "5"))

    # ── Reintentos ────────────────────────────────────────────────────────────
    # Cuántas veces reintentar un job fallido antes de mandarlo a DLQ
    MAX_RETRIES: int = int(os.environ.get("WORKER_MAX_RETRIES", "3"))
    # Backoff base en segundos (se multiplica por intento: 2s, 4s, 8s...)
    RETRY_BACKOFF_BASE: float = float(os.environ.get("WORKER_RETRY_BACKOFF", "2.0"))

    # ── BLPOP ─────────────────────────────────────────────────────────────────
    # Timeout del BLPOP en segundos; 0 = bloquea indefinidamente
    BLPOP_TIMEOUT: int = int(os.environ.get("WORKER_BLPOP_TIMEOUT", "5"))

    # ── Entorno ───────────────────────────────────────────────────────────────
    ENV_NAME: str = os.environ.get("ENV_NAME", "dev")

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


settings = WorkerConfig()
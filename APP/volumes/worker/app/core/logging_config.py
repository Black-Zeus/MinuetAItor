# core/logging_config.py
"""
Configuración de logging del worker.

Salidas simultáneas:
    - stdout        → visible en `docker logs` (siempre)
    - archivo       → /var/log/app/worker.log con rotación (si LOG_DIR existe)

Rotación:
    - Tamaño máximo por archivo : LOG_MAX_BYTES  (default 10 MB)
    - Archivos de backup        : LOG_BACKUP_COUNT (default 5)
    → conserva hasta 50 MB de historial por defecto

Variables de entorno:
    LOG_LEVEL        DEBUG | INFO | WARNING | ERROR   (default: INFO)
    LOG_DIR          ruta al directorio de logs        (default: /var/log/app)
    LOG_MAX_BYTES    tamaño máximo en bytes            (default: 10485760)
    LOG_BACKUP_COUNT cantidad de archivos de backup    (default: 5)
"""
import logging
import logging.handlers
import os
import sys


_FMT     = "%(asctime)s [%(levelname)-8s] %(name)-30s — %(message)s"
_DATEFMT = "%Y-%m-%d %H:%M:%S"


def setup_logging() -> None:
    """
    Inicializa stdout + archivo rotativo.
    Llamar una sola vez al arranque del worker.
    """
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level      = getattr(logging, level_name, logging.INFO)

    formatter = logging.Formatter(_FMT, datefmt=_DATEFMT)

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()

    # ── Handler 1: stdout (siempre activo) ───────────────────────────────────
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(formatter)
    stdout_handler.setLevel(level)
    root.addHandler(stdout_handler)

    # ── Handler 2: archivo con rotación (si el directorio existe o se puede crear)
    log_dir          = os.environ.get("LOG_DIR", "/var/log/app")
    max_bytes        = int(os.environ.get("LOG_MAX_BYTES",    str(10 * 1024 * 1024)))  # 10 MB
    backup_count     = int(os.environ.get("LOG_BACKUP_COUNT", "5"))

    try:
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, "worker.log")

        file_handler = logging.handlers.RotatingFileHandler(
            filename    = log_path,
            maxBytes    = max_bytes,
            backupCount = backup_count,
            encoding    = "utf-8",
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(level)
        root.addHandler(file_handler)

        # Usar getLogger aquí porque root ya está configurado
        logging.getLogger("worker.logging").info(
            "Log a archivo activo | path=%s max=%dMB backups=%d",
            log_path, max_bytes // (1024 * 1024), backup_count,
        )

    except OSError as e:
        logging.getLogger("worker.logging").warning(
            "No se pudo configurar log a archivo | dir=%s error=%s — solo stdout",
            log_dir, e,
        )

    # ── Silenciar librerías ruidosas ──────────────────────────────────────────
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    logging.getLogger("redis").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
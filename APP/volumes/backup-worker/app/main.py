import logging
import os
import signal
import time


logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("backup-worker")
running = True


def _handle_stop(signum, frame):
    global running
    running = False
    logger.info("Senal de termino recibida | signal=%s", signum)


def main():
    signal.signal(signal.SIGINT, _handle_stop)
    signal.signal(signal.SIGTERM, _handle_stop)

    logger.info(
        "Backup worker skeleton iniciado | queue=%s backup_root=%s backend=%s",
        os.environ.get("BACKUP_QUEUE", "queue:backups"),
        os.environ.get("BACKUP_STORAGE_ROOT", "/app/remote_data/backups"),
        os.environ.get("BACKEND_INTERNAL_URL", "-"),
    )
    logger.info("Implementacion de handlers pendiente: db_backup, object_backup, full_backup, restore_backup, backup_purge")

    while running:
        time.sleep(5)

    logger.info("Backup worker skeleton detenido")


if __name__ == "__main__":
    main()

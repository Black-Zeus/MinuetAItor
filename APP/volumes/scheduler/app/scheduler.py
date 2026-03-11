# scheduler.py
import json
import logging
import os
import time
import urllib.error
import urllib.request

import redis
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("scheduler")

REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
BACKEND_INTERNAL_URL = os.environ.get("BACKEND_INTERNAL_URL", "http://backend:8000")
INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "-")

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


def enqueue(queue: str, job: dict) -> None:
    r.rpush(queue, json.dumps(job))
    logger.info("Job encolado | queue=%s | type=%s", queue, job.get("type"))


# ── Definición de jobs ────────────────────────────────────────────────────────

def _post_internal(path: str, body: dict | None = None) -> dict:
    payload = json.dumps(body or {}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BACKEND_INTERNAL_URL.rstrip('/')}{path}",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-internal-secret": INTERNAL_API_SECRET,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def job_pending_publication_reminders():
    """Dispara recordatorios de minutas pendientes desde el backend."""
    try:
        result = _post_internal("/internal/v1/notifications/reminders/pending-publication")
        logger.info("Reminder batch OK | sent=%s", result.get("sent", 0))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.error("Reminder batch HTTP error | status=%s body=%s", exc.code, body[:300])
    except Exception as exc:
        logger.error("Reminder batch failed | err=%s", exc)


def job_db_backup():
    """Encola tarea de respaldo de base de datos."""
    enqueue("queue:maintenance", {
        "type":   "db_backup",
        "target": "mariadb",
    })


def job_cleanup_sessions():
    """Encola limpieza de sesiones expiradas."""
    enqueue("queue:maintenance", {
        "type": "cleanup_sessions",
    })


# ── Configuración del scheduler ───────────────────────────────────────────────

def main():
    scheduler = BlockingScheduler(timezone="America/Santiago")

    # Resumen diario — lunes a viernes a las 8:00am
    scheduler.add_job(
        job_pending_publication_reminders,
        CronTrigger(day_of_week="mon-fri", hour=8, minute=0),
        id="pending_publication_reminders",
        name="Reminder minutas pendientes",
    )

    # Respaldo BD — todos los días a las 2:00am
    scheduler.add_job(
        job_db_backup,
        CronTrigger(hour=2, minute=0),
        id="db_backup",
        name="Respaldo base de datos",
    )

    # Limpieza sesiones — cada hora
    scheduler.add_job(
        job_cleanup_sessions,
        CronTrigger(minute=0),
        id="cleanup_sessions",
        name="Limpieza sesiones expiradas",
    )

    logger.info("Scheduler iniciado | jobs=%d", len(scheduler.get_jobs()))   
    
    scheduler.start()


if __name__ == "__main__":
    main()

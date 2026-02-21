# scheduler.py
import json
import logging
import os
import time

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

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


def enqueue(queue: str, job: dict) -> None:
    r.rpush(queue, json.dumps(job))
    logger.info("Job encolado | queue=%s | type=%s", queue, job.get("type"))


# ── Definición de jobs ────────────────────────────────────────────────────────

def job_daily_summary():
    """Encola email de resumen diario."""
    enqueue("queue:email", {
        "type":       "email",
        "to":         ["admin@minuetaitor.cl"],
        "subject":    "Resumen diario MinuetAItor",
        "body":       "<h1>Resumen del día</h1>",  # en el futuro el worker construye esto
        "email_type": "html",
    })


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
        job_daily_summary,
        CronTrigger(day_of_week="mon-fri", hour=8, minute=0),
        id="daily_summary",
        name="Resumen diario email",
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

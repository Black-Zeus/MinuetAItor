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


def _unwrap_contract(result: dict | None) -> dict:
    if not isinstance(result, dict):
        return {}
    if isinstance(result.get("result"), dict):
        return result["result"]
    return result


def job_pending_publication_reminders():
    """Dispara recordatorios de minutas pendientes desde el backend."""
    try:
        result = _unwrap_contract(_post_internal("/internal/v1/notifications/reminders/pending-publication"))
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


def job_maintenance_tick():
    """Delegación de mantenimiento dinámico según configuración persistida."""
    try:
        result = _unwrap_contract(_post_internal("/internal/v1/maintenance/tick"))
        logger.info(
            "Maintenance tick OK | slot=%s | enqueued=%s | queue_alerts=%s",
            result.get("currentSlot") or result.get("current_slot"),
            ",".join(item.get("action", "?") for item in result.get("enqueued", [])) or "-",
            len(result.get("queueAlerts", []) or result.get("queue_alerts", []) or []),
        )
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.error("Maintenance tick HTTP error | status=%s body=%s", exc.code, body[:300])
    except Exception as exc:
        logger.error("Maintenance tick failed | err=%s", exc)


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

    # Tick de mantenimiento dinámico — cada minuto
    scheduler.add_job(
        job_maintenance_tick,
        CronTrigger(),
        id="maintenance_tick",
        name="Tick mantenimiento dinámico",
    )

    logger.info("Scheduler iniciado | jobs=%d", len(scheduler.get_jobs()))   
    
    scheduler.start()


if __name__ == "__main__":
    main()

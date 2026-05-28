# scheduler.py
import json
import logging
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("scheduler")


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


BACKEND_INTERNAL_URL = os.environ.get("BACKEND_INTERNAL_URL", "http://backend:8000")
INTERNAL_API_SECRET = _env_or_file("INTERNAL_API_SECRET", "-")


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


def job_system_backups_tick():
    """Delegación de respaldos programados según configuración persistida."""
    try:
        result = _unwrap_contract(_post_internal("/internal/v1/system/backups/tick"))
        logger.info(
            "System backups tick OK | slot=%s | enqueued=%s",
            result.get("currentSlot") or result.get("current_slot"),
            ",".join(
                f"{item.get('scope', '?')}:{item.get('action', '-')}"
                for item in result.get("enqueued", [])
            ) or "-",
        )
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.error("System backups tick HTTP error | status=%s body=%s", exc.code, body[:300])
    except Exception as exc:
        logger.error("System backups tick failed | err=%s", exc)


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

    # Respaldos programados — delegados al backend para evaluar políticas
    scheduler.add_job(
        job_system_backups_tick,
        CronTrigger(second=0),
        id="system_backups_tick",
        name="Tick respaldos programados",
    )

    # Tick de mantenimiento dinámico — cada minuto
    scheduler.add_job(
        job_maintenance_tick,
        CronTrigger(second=0),
        id="maintenance_tick",
        name="Tick mantenimiento dinámico",
    )

    logger.info("Scheduler iniciado | jobs=%d", len(scheduler.get_jobs()))   
    
    scheduler.start()


if __name__ == "__main__":
    main()

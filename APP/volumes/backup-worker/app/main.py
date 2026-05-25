from __future__ import annotations

import asyncio
import logging
import signal
import traceback
from datetime import datetime, timezone

from core.config import settings
from core.job import JobEnvelope
from core.redis_client import close_redis, get_redis
from handlers import handle_backup_job
from tools import REQUIRED_TOOLS_BY_JOB_TYPE, check_tool


logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("backup-worker")
QUEUE_ACTIVITY_HASH = "system:queue:last_activity"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _send_to_dlq(job: JobEnvelope, error_trace: str) -> None:
    redis = await get_redis()
    payload = {
        "failed_at": _utcnow_iso(),
        "error": error_trace[-4000:],
        "job": {
            "job_id": job.job_id,
            "type": job.type,
            "queue": job.queue,
            "attempt": job.attempt,
            "payload": job.payload,
        },
    }
    await redis.rpush(settings.dlq_queue, JobEnvelope(
        job_id=job.job_id,
        type=f"failed:{job.type}",
        queue=settings.dlq_queue,
        attempt=job.attempt,
        payload=payload,
    ).to_json())


async def _execute_job(job: JobEnvelope, sem: asyncio.Semaphore) -> None:
    async with sem:
        try:
            logger.info(
                "Iniciando job | job_id=%s type=%s attempt=%d",
                job.job_id,
                job.type,
                job.attempt,
            )
            await handle_backup_job(job)
            logger.info("Job completado | job_id=%s type=%s", job.job_id, job.type)
        except Exception as exc:
            error_trace = traceback.format_exc()
            logger.error(
                "Job fallido | job_id=%s type=%s attempt=%d/%d error=%s",
                job.job_id,
                job.type,
                job.attempt,
                settings.max_retries,
                exc,
            )
            redis = await get_redis()
            if job.attempt < settings.max_retries:
                delay = settings.retry_backoff_base ** job.attempt
                logger.info("Reintentando job en %.1fs | job_id=%s", delay, job.job_id)
                await asyncio.sleep(delay)
                await redis.rpush(settings.backup_queue, job.next_attempt().to_json())
                return

            logger.error("Enviando job a DLQ | job_id=%s dlq=%s", job.job_id, settings.dlq_queue)
            await _send_to_dlq(job, error_trace)


async def _main_loop(stop_event: asyncio.Event) -> None:
    sem = asyncio.Semaphore(settings.max_concurrent_jobs)
    active_tasks: set[asyncio.Task] = set()
    logger.info(
        "Backup worker listo | queue=%s dlq=%s max_concurrent=%d max_retries=%d",
        settings.backup_queue,
        settings.dlq_queue,
        settings.max_concurrent_jobs,
        settings.max_retries,
    )

    while not stop_event.is_set():
        try:
            redis = await get_redis()
            result = await redis.blpop([settings.backup_queue], timeout=settings.blpop_timeout)
            if result is None:
                continue

            queue_key, raw = result
            try:
                job = JobEnvelope.from_raw(raw, queue_key)
            except Exception as exc:
                logger.error("Job invalido descartado | queue=%s error=%s raw=%.300s", queue_key, exc, raw)
                continue

            await redis.hset(QUEUE_ACTIVITY_HASH, queue_key, _utcnow_iso())
            task = asyncio.create_task(_execute_job(job, sem), name=f"backup-job-{job.job_id}")
            active_tasks.add(task)
            task.add_done_callback(active_tasks.discard)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.exception("Error en loop principal | error=%s", exc)
            await asyncio.sleep(2)

    if active_tasks:
        logger.info("Esperando jobs activos | count=%d", len(active_tasks))
        await asyncio.gather(*active_tasks, return_exceptions=True)


def _log_tool_status() -> None:
    tool_names = sorted({name for names in REQUIRED_TOOLS_BY_JOB_TYPE.values() for name in names})
    for name in tool_names:
        check = check_tool(name)
        if check.available:
            logger.info("Herramienta OK | %s=%s", name, check.path)
        else:
            logger.warning("Herramienta faltante | %s", name)


async def main() -> None:
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    logger.info("=" * 60)
    logger.info("MinuetAItor Backup Worker arrancando")
    logger.info("Env: %s | App version: %s", settings.env_name, settings.app_version or "-")
    logger.info("Redis: %s:%s/%s", settings.redis_host, settings.redis_port, settings.redis_db)
    logger.info("Backup root: %s", settings.backup_storage_root)
    logger.info("Maintenance marker: %s", settings.maintenance_state_file)
    logger.info("=" * 60)
    _log_tool_status()

    try:
        await _main_loop(stop_event)
    finally:
        await close_redis()
        logger.info("Backup worker detenido")


if __name__ == "__main__":
    asyncio.run(main())

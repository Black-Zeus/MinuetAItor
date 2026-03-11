# main.py
"""
pdf-worker — MinuetAItor

Loop principal: BLPOP en queue:pdf
Dispatcher:     type='minute_pdf' → handlers/minute_pdf.py
                type='report_pdf' → handlers/report_pdf.py  (futuro)
"""
from __future__ import annotations

import asyncio
import traceback

from core.config         import settings
from core.job            import JobEnvelope
from core.logging_config import get_logger, setup_logging
from core.redis_client   import close_redis, get_redis
from handlers.minute_pdf import handle_minute_pdf

logger = get_logger("pdf-worker.main")

QUEUE_PRIORITY = ["queue:pdf"]

HANDLERS = {
    "minute_pdf": handle_minute_pdf,
    # "report_pdf": handle_report_pdf,   ← futuro
}


async def _execute_job(job: JobEnvelope, sem: asyncio.Semaphore) -> None:
    async with sem:
        handler = HANDLERS.get(job.type)
        if handler is None:
            logger.warning("Sin handler | type=%s — descartado", job.type)
            return

        try:
            logger.info("Iniciando | job_id=%s type=%s attempt=%d",
                        job.job_id, job.type, job.attempt)
            await handler(job)
            logger.info("Completado | job_id=%s", job.job_id)

        except Exception as exc:
            error_trace = traceback.format_exc()
            logger.error("Fallido | job_id=%s attempt=%d/%d | %s\n%s",
             job.job_id, job.attempt, settings.MAX_RETRIES, exc,
             traceback.format_exc())

            redis = await get_redis()

            if job.attempt < settings.MAX_RETRIES:
                delay = settings.RETRY_BACKOFF_BASE ** job.attempt
                logger.info("Reintentando en %.1fs | job_id=%s", delay, job.job_id)
                await asyncio.sleep(delay)
                await redis.rpush(job.queue, job.next_attempt().to_json())
            else:
                # DLQ simple
                import json
                from datetime import datetime, timezone
                dlq_record = {
                    "job_id":    job.job_id, "type": job.type,
                    "queue":     job.queue,  "attempt": job.attempt,
                    "payload":   job.payload,
                    "failed_at": datetime.now(timezone.utc).isoformat(),
                    "error":     error_trace[:2000],
                }
                await redis.rpush("queue:dlq", json.dumps(dlq_record))
                logger.error("Job enviado a DLQ | job_id=%s", job.job_id)


async def main_loop() -> None:
    sem = asyncio.Semaphore(settings.MAX_CONCURRENT_JOBS)
    active_tasks: set[asyncio.Task] = set()

    logger.info("pdf-worker listo | queues=%s | max_concurrent=%d",
                QUEUE_PRIORITY, settings.MAX_CONCURRENT_JOBS)

    while True:
        try:
            redis = await get_redis()
            result = await redis.blpop(QUEUE_PRIORITY, timeout=settings.BLPOP_TIMEOUT)

            if result is None:
                continue

            queue_key, raw = result

            try:
                job = JobEnvelope.from_raw(raw, queue_key)
            except Exception as e:
                logger.error("Job inválido descartado | queue=%s error=%s", queue_key, e)
                continue

            task = asyncio.create_task(_execute_job(job, sem), name=f"job-{job.job_id}")
            active_tasks.add(task)
            task.add_done_callback(active_tasks.discard)

        except asyncio.CancelledError:
            logger.info("pdf-worker cancelado — esperando tasks activas...")
            if active_tasks:
                await asyncio.gather(*active_tasks, return_exceptions=True)
            break
        except Exception as e:
            logger.exception("Error en loop | %s", e)
            await asyncio.sleep(2)


async def main() -> None:
    setup_logging()
    try:
        await main_loop()
    finally:
        await close_redis()


if __name__ == "__main__":
    asyncio.run(main())
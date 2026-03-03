# worker.py
"""
Worker principal de MinuetAItor.

Arquitectura:
    - asyncio event loop único
    - Semáforo para limitar concurrencia (MAX_CONCURRENT_JOBS)
    - BLPOP sobre múltiples colas con prioridad
    - Reintentos con backoff exponencial
    - Dead Letter Queue para jobs que agotan reintentos
    - Registro central de handlers (core/registry.py)
    - Fácil extensión: agregar cola = registrar en queues/__init__.py

Flujo por job:
    BLPOP → parse JobEnvelope → buscar handler → ejecutar (asyncio Task)
         → OK: log completed
         → FAIL (reintentable): reencolar con attempt+1 + backoff
         → FAIL (agotado): DLQ
"""
from __future__ import annotations

import asyncio
import traceback

from core.config       import settings
from core.dlq          import send_to_dlq
from core.job          import JobEnvelope
from core.logging_config import get_logger, setup_logging
from core.redis_client import close_redis, get_redis
from core import registry
from queues import register_all, QUEUE_PRIORITY

logger = get_logger("worker.main")


# ── Procesamiento de un job ───────────────────────────────────────────────────

async def _execute_job(job: JobEnvelope, sem: asyncio.Semaphore) -> None:
    """
    Ejecuta un job dentro del semáforo de concurrencia.
    Maneja reintentos y DLQ internamente.
    """
    async with sem:
        handler = registry.get(job.queue, job.type)

        if handler is None:
            logger.warning(
                "Sin handler | job_id=%s type=%s queue=%s — descartado",
                job.job_id, job.type, job.queue,
            )
            return

        try:
            logger.info(
                "Iniciando job | job_id=%s type=%s queue=%s attempt=%d",
                job.job_id, job.type, job.queue, job.attempt,
            )
            await handler(job.payload)
            logger.info(
                "Job completado | job_id=%s type=%s attempt=%d",
                job.job_id, job.type, job.attempt,
            )

        except Exception as exc:
            error_trace = traceback.format_exc()
            logger.error(
                "Job fallido | job_id=%s type=%s attempt=%d/%d | error=%s",
                job.job_id, job.type, job.attempt, settings.MAX_RETRIES, exc,
            )

            redis = await get_redis()

            if job.attempt < settings.MAX_RETRIES:
                # ── Reintento con backoff exponencial ────────────────────────
                delay = settings.RETRY_BACKOFF_BASE ** job.attempt
                logger.info(
                    "Reintentando en %.1fs | job_id=%s attempt=%d→%d",
                    delay, job.job_id, job.attempt, job.attempt + 1,
                )
                await asyncio.sleep(delay)
                next_job = job.next_attempt()
                await redis.rpush(job.queue, next_job.to_json())

            else:
                # ── DLQ: agotó reintentos ─────────────────────────────────
                await send_to_dlq(redis, job, error_trace)


# ── Loop principal ────────────────────────────────────────────────────────────

async def main_loop() -> None:
    """
    Loop principal del worker.

    - Espera jobs con BLPOP (blocking, no gasta CPU)
    - Lanza cada job como asyncio.Task independiente
    - El semáforo limita cuántos corren en paralelo
    - La reconexión Redis está encapsulada en get_redis()
    """
    sem = asyncio.Semaphore(settings.MAX_CONCURRENT_JOBS)
    active_tasks: set[asyncio.Task] = set()

    logger.info(
        "Worker listo | queues=%s | max_concurrent=%d | max_retries=%d",
        QUEUE_PRIORITY,
        settings.MAX_CONCURRENT_JOBS,
        settings.MAX_RETRIES,
    )

    while True:
        try:
            redis = await get_redis()

            # BLPOP bloquea hasta que llega un mensaje o timeout
            result = await redis.blpop(QUEUE_PRIORITY, timeout=settings.BLPOP_TIMEOUT)

            if result is None:
                # Timeout normal — volver a escuchar
                continue

            queue_key, raw = result

            try:
                job = JobEnvelope.from_raw(raw, queue_key)
            except Exception as parse_err:
                logger.error(
                    "Job inválido descartado | queue=%s error=%s raw=%.200s",
                    queue_key, parse_err, raw,
                )
                continue

            # Lanzar como Task independiente para no bloquear el BLPOP
            task = asyncio.create_task(
                _execute_job(job, sem),
                name=f"job-{job.job_id}",
            )
            active_tasks.add(task)
            task.add_done_callback(active_tasks.discard)

        except asyncio.CancelledError:
            logger.info("Worker cancelado — esperando tasks activas...")
            if active_tasks:
                await asyncio.gather(*active_tasks, return_exceptions=True)
            break

        except Exception as loop_err:
            # Error inesperado en el loop — loguear y continuar
            logger.exception("Error en el loop principal | error=%s", loop_err)
            await asyncio.sleep(2)


# ── Arranque ──────────────────────────────────────────────────────────────────

async def main() -> None:
    setup_logging()

    logger.info("=" * 60)
    logger.info("MinuetAItor Worker arrancando")
    logger.info("Redis:  %s:%s", settings.REDIS_HOST, settings.REDIS_PORT)
    logger.info("Env:    %s",    settings.ENV_NAME)
    logger.info("=" * 60)

    # Registrar todos los handlers antes de arrancar el loop
    register_all()

    # Log del mapa de handlers para confirmar configuración
    for queue, types in registry.summary().items():
        logger.info("  %-30s → %s", queue, types)

    try:
        await main_loop()
    finally:
        await close_redis()
        logger.info("Worker detenido.")


if __name__ == "__main__":
    asyncio.run(main())
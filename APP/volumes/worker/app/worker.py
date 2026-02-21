# worker.py
"""
Worker de colas Redis.
Procesa jobs de múltiples tipos usando BLPOP (blocking pop).

Cola principal: queue:email
"""

import json
import logging
import os
import time

import redis

from handlers.email_handler import handle_email_job

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker")

# ── Configuración ─────────────────────────────────────────────────────────────
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))

# Colas que escucha el worker (en orden de prioridad)
QUEUES = ["queue:email"]

# Tiempo máximo de espera en BLPOP (segundos); 0 = infinito
BLPOP_TIMEOUT = 5

# ── Dispatcher ───────────────────────────────────────────────────────────────
HANDLERS = {
    "email": handle_email_job,
    # Agrega nuevos tipos aquí:
    # "pdf": handle_pdf_job,
    # "ai": handle_ai_job,
}


def process_job(queue: str, raw: str) -> None:
    try:
        job = json.loads(raw)
        job_type = job.get("type")

        if job_type not in HANDLERS:
            logger.warning("Tipo de job desconocido: %s | queue=%s", job_type, queue)
            return

        logger.info("Procesando job | type=%s | queue=%s", job_type, queue)
        HANDLERS[job_type](job)
        logger.info("Job completado  | type=%s", job_type)

    except json.JSONDecodeError as e:
        logger.error("JSON inválido en cola %s | error=%s | raw=%s", queue, e, raw[:200])
    except KeyError as e:
        logger.error("Campo faltante en job | error=%s", e)
    except Exception as e:
        logger.exception("Error inesperado procesando job | error=%s", e)


# ── Main loop ─────────────────────────────────────────────────────────────────
def main() -> None:
    logger.info("Worker iniciando | redis=%s:%s | queues=%s", REDIS_HOST, REDIS_PORT, QUEUES)

    r: redis.Redis | None = None

    while True:
        try:
            if r is None:
                r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
                r.ping()
                logger.info("Conectado a Redis")

            result = r.blpop(QUEUES, timeout=BLPOP_TIMEOUT)

            if result is None:
                continue  # timeout, vuelve a escuchar

            queue, raw = result
            process_job(queue, raw)

        except redis.ConnectionError as e:
            logger.error("Redis desconectado | error=%s | reintentando en 5s...", e)
            r = None
            time.sleep(5)

        except KeyboardInterrupt:
            logger.info("Worker detenido manualmente.")
            break


if __name__ == "__main__":
    main()
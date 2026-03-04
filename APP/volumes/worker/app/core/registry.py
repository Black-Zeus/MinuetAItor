# core/registry.py
"""
Registro central de handlers.

Cada cola registra qué handler ejecuta cada tipo de job.
El dispatcher consulta este registro — nunca importa handlers directamente.

Uso:
    # En queues/email_queue.py:
    registry.register("queue:email", "email", handle_email_job)

    # El dispatcher:
    handler = registry.get("queue:email", "email")
"""
from __future__ import annotations

import asyncio
from typing import Callable, Coroutine, Any

from core.logging_config import get_logger
from core.job import JobEnvelope  # Importar JobEnvelope

logger = get_logger("worker.registry")

# Tipo de un handler: función async que recibe el JobEnvelope completo
HandlerFn = Callable[[JobEnvelope], Coroutine[Any, Any, None]]

# { queue_name: { job_type: handler_fn } }
_registry: dict[str, dict[str, HandlerFn]] = {}


def register(queue: str, job_type: str, handler: HandlerFn) -> None:
    """
    Registra un handler para (queue, job_type).
    Si ya existe uno para esa combinación, lo sobreescribe con warning.
    """
    if queue not in _registry:
        _registry[queue] = {}

    if job_type in _registry[queue]:
        logger.warning(
            "Handler reemplazado | queue=%s type=%s old=%s new=%s",
            queue, job_type,
            _registry[queue][job_type].__name__,
            handler.__name__,
        )

    _registry[queue][job_type] = handler
    logger.debug("Handler registrado | queue=%s type=%s fn=%s", queue, job_type, handler.__name__)


def get(queue: str, job_type: str) -> HandlerFn | None:
    """Retorna el handler para (queue, job_type), o None si no existe."""
    return _registry.get(queue, {}).get(job_type)


def get_all_queues() -> list[str]:
    """Lista de todas las colas registradas."""
    return list(_registry.keys())


def summary() -> dict[str, list[str]]:
    """Mapa legible: { queue: [job_types] } para logging al arranque."""
    return {q: list(types.keys()) for q, types in _registry.items()}
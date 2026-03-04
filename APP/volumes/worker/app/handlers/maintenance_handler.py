# handlers/maintenance_handler.py
"""
Handler de jobs de tipo 'maintenance'.

Agrupa tareas de mantenimiento del sistema: backups, limpiezas, etc.
Cada subtipo se despacha internamente por el campo "action" del payload
o por el job.type del envelope.

Payload esperado:
{
    "action": "db_backup" | "cleanup_sessions" | "cleanup_temp_files",
    ...campos adicionales según action
}

Para agregar una nueva acción:
    1. Crear función async _handle_<action>(payload) en este archivo
    2. Registrarla en ACTIONS al final del archivo
"""
from __future__ import annotations

import asyncio
from typing import Any

from core.logging_config import get_logger
from core.job import JobEnvelope

logger = get_logger("worker.handler.maintenance")


# ── Sub-handlers por acción ───────────────────────────────────────────────────

async def _handle_db_backup(payload: dict[str, Any]) -> None:
    target = payload.get("target", "mariadb")
    logger.info("Iniciando backup | target=%s", target)
    # TODO: implementar lógica de backup (mysqldump, MinIO upload, etc.)
    await asyncio.sleep(0)  # placeholder
    logger.info("Backup completado | target=%s", target)


async def _handle_cleanup_sessions(payload: dict[str, Any]) -> None:
    logger.info("Limpiando sesiones expiradas...")
    # TODO: conectar a Redis y limpiar keys session:* expiradas
    await asyncio.sleep(0)
    logger.info("Sesiones limpiadas.")


async def _handle_cleanup_temp_files(payload: dict[str, Any]) -> None:
    max_age_days = payload.get("max_age_days", 7)
    logger.info("Limpiando archivos temporales con más de %d días...", max_age_days)
    # TODO: limpiar /app/assets/temp/ con más de N días
    await asyncio.sleep(0)
    logger.info("Archivos temporales limpiados.")


# ── Dispatcher interno ────────────────────────────────────────────────────────

_ACTIONS: dict[str, Any] = {
    "db_backup":          _handle_db_backup,
    "cleanup_sessions":   _handle_cleanup_sessions,
    "cleanup_temp_files": _handle_cleanup_temp_files,
}


async def handle_maintenance_job(job: JobEnvelope) -> None:
    """
    Handle maintenance jobs recibiendo el envelope completo.
    
    La acción puede venir de dos fuentes:
    1. Del campo 'action' en el payload (formato nuevo recomendado)
    2. Del job.type del envelope (para compatibilidad con jobs existentes)
    """
    payload = job.payload
    
    # Prioridad: campo 'action' en payload > job.type
    action = payload.get("action") or job.type
    
    if not action:
        raise ValueError("No se pudo determinar la acción para el job de maintenance")

    handler = _ACTIONS.get(action)

    if handler is None:
        raise ValueError(f"Acción de maintenance desconocida: {action!r}")

    logger.info(
        "Ejecutando acción de mantenimiento | action=%s job_id=%s type=%s attempt=%d",
        action, job.job_id, job.type, job.attempt
    )
    await handler(payload)
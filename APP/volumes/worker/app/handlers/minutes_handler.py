# handlers/minutes_handler.py
"""
Handler de jobs de tipo 'minutes'.

Responsable de ejecutar TX2 del pipeline de generación de minutas:
    - Llamar a OpenAI
    - Crear RecordVersion + RecordArtifacts de output
    - Actualizar MinuteTransaction a "completed" o "failed"
    - Publicar evento de notificación en Redis Pub/Sub

Payload esperado (generado por el backend en TX1):
{
    "transaction_id":  "uuid",
    "record_id":       "uuid",
    "requested_by_id": "uuid",
    "ai_profile": {
        "profile_id":          "uuid",
        "profile_name":        "...",
        "profile_description": "...",
        "profile_prompt":      "..."
    },
    "meeting_info": {
        "title":                "...",
        "scheduled_date":       "YYYY-MM-DD",
        "location":             "...",
        "scheduled_start_time": "HH:MM",
        "scheduled_end_time":   "HH:MM",
        "actual_start_time":    "HH:MM",
        "actual_end_time":      "HH:MM"
    },
    "additional_notes": "...",
    "input_objects": [
        {
            "obj_id":      "uuid",
            "object_key":  "record_id/filename.txt",
            "bucket":      "minuetaitor-inputs",
            "file_type":   "transcription" | "summary",
            "art_type_id": "uuid"
        }
    ]
}

Al completar, publica en Redis Pub/Sub:
    Canal: events:minutes
    Mensaje: { "event": "completed"|"failed", "transaction_id": "...", "record_id": "..." }
"""
from __future__ import annotations

import asyncio
from typing import Any

from core.logging_config import get_logger

logger = get_logger("worker.handler.minutes")

# Canal Pub/Sub donde se publican resultados para que el backend notifique al frontend
PUBSUB_CHANNEL = "events:minutes"


async def handle_minutes_job(payload: dict[str, Any]) -> None:
    """
    TODO: implementar TX2 aquí cuando se migre desde minutes_service.py.

    Estructura de referencia:
        1. Conectar a MariaDB (SQLAlchemy sync en executor)
        2. Descargar archivos de MinIO
        3. Llamar OpenAI (en executor — operación lenta)
        4. Crear RecordVersion + RecordArtifacts
        5. Actualizar MinuteTransaction status="completed"
        6. Publicar evento en Redis Pub/Sub → canal PUBSUB_CHANNEL
    """
    transaction_id = payload.get("transaction_id", "unknown")
    record_id      = payload.get("record_id",      "unknown")

    logger.info(
        "Procesando minuta | transaction_id=%s record_id=%s",
        transaction_id, record_id,
    )

    # Placeholder hasta migrar TX2
    await asyncio.sleep(0)

    logger.info(
        "Minuta procesada (placeholder) | transaction_id=%s",
        transaction_id,
    )


async def _publish_result(
    redis_client: Any,
    event:        str,
    transaction_id: str,
    record_id:    str,
    error:        str | None = None,
) -> None:
    """
    Publica el resultado al canal Pub/Sub.
    El backend (SSE/WebSocket) escucha este canal y notifica al frontend.
    """
    import json
    msg = {
        "event":          event,
        "transaction_id": transaction_id,
        "record_id":      record_id,
    }
    if error:
        msg["error"] = error[:500]

    await redis_client.publish(PUBSUB_CHANNEL, json.dumps(msg))
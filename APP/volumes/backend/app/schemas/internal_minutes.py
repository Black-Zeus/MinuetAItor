# schemas/internal_minutes.py
"""
Schemas del endpoint interno POST /internal/v1/minutes/commit

Consumido exclusivamente por el worker. No forma parte de la API pública.
"""
from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class MinuteCommitRequest(BaseModel):
    """
    Payload que envía el worker al backend tras completar el procesamiento OpenAI.

    El worker es responsable de:
      - Llamar a OpenAI
      - Descargar archivos de MinIO
      - Enviar este payload al backend

    El backend es responsable de:
      - Crear RecordVersion
      - Crear RecordArtifacts (LLM original + canonical)
      - Actualizar MinuteTransaction (status, tokens, run_id)
      - Actualizar Record (status → ready-for-edit, latest_version_num)
      - Subir JSON de output a MinIO (minuetaitor-json)
      - Publicar evento SSE vía Redis Pub/Sub
    """
    transaction_id: str = Field(..., description="ID de MinuteTransaction (TX1)")
    record_id: str = Field(..., description="ID del Record asociado")
    requested_by_id: str = Field(..., description="ID del usuario que solicitó la generación")

    # Output de OpenAI
    ai_output: dict[str, Any] = Field(..., description="JSON estructurado retornado por OpenAI")
    ai_input_schema: dict[str, Any] = Field(
        default_factory=dict,
        description="Schema de entrada usado para generar la minuta",
    )
    openai_run_id: str = Field(..., description="ID del run de OpenAI (chatcmpl-xxx)")
    tokens_input: int = Field(..., ge=0, description="Tokens consumidos en el prompt")
    tokens_output: int = Field(..., ge=0, description="Tokens generados en la respuesta")

    # Metadatos de los objetos de entrada (para crear RecordArtifacts de inputs)
    input_objects_meta: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Metadatos de los objetos MinIO de entrada (transcript, summary)",
    )

    # IDs del catálogo necesarios para crear Objects en BD
    catalog_ids: dict[str, Any] = Field(
        default_factory=dict,
        description="IDs de catálogo: bucket_json_id, artifact_type ids, artifact_state ids",
    )

    model_config = {"populate_by_name": True}


class MinuteCommitResponse(BaseModel):
    """
    Respuesta del backend al worker tras persistir el resultado de TX2.
    """
    ok: bool = True
    record_id: str
    version_id: str
    transaction_id: str
    message: str = "TX2 completada exitosamente"

    model_config = {"populate_by_name": True}


class MinuteCommitErrorResponse(BaseModel):
    """
    Respuesta de error — el worker usa esto para decidir si reintenta.
    """
    ok: bool = False
    error: str
    detail: str | None = None
    retryable: bool = True  # False = error de datos, no reintenta

    model_config = {"populate_by_name": True}

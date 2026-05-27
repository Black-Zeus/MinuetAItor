# schemas/internal_minutes.py
"""
Schemas de endpoints internos del pipeline de minutas.

Consumido exclusivamente por el worker. No forma parte de la API pública.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class ActiveAIProviderConfigResponse(BaseModel):
    """
    Configuración runtime de la integración AI activa.

    Consumida por el worker vía API interna para resolver el proveedor/modelo
    efectivo sin leer secretos desde .env.
    """
    id: str
    name: str
    provider_type: str = Field(..., description="Tipo de proveedor activo, ej: openai")
    provider_family: str = Field(..., description="Familia/protocolo del proveedor")
    execution_adapter: str = Field(..., description="Adapter normalizado que el worker debe usar para ejecutar la inferencia")
    base_url: str = Field(..., description="Base URL efectiva para el cliente del worker")
    model_name: str = Field(..., description="Modelo configurado para procesamiento")
    auth_type: str = Field(..., description="Modo de autenticación configurado")
    token: str | None = Field(None, description="Token/API key desenmascarado para uso interno")
    username: str | None = None
    password: str | None = None
    custom_headers: dict[str, str] | None = Field(None, description="Headers personalizados efectivos")
    timeout_seconds: int = Field(..., ge=1, description="Timeout efectivo para llamadas al proveedor")
    validation_status: str = Field(..., description="Estado de validación de la configuración activa")

    model_config = {"populate_by_name": True}


class MinuteCommitRequest(BaseModel):
    """
    Payload que envía el worker al backend tras completar el procesamiento OpenAI.

    El worker es responsable de:
      - Llamar a OpenAI
      - Descargar archivos de MinIO
      - Enviar este payload al backend

    El backend es responsable de:
      - Crear RecordVersion técnica v0
      - Crear RecordArtifacts (LLM original + canonical)
      - Actualizar MinuteTransaction (status, tokens, run_id)
      - Actualizar Record (status → ready-for-edit, active_version_id)
      - Subir JSON de output a MinIO (minuetaitor-json)
      - Publicar evento SSE vía Redis Pub/Sub
    """
    transaction_id: str = Field(..., description="ID de MinuteTransaction (TX1)")
    record_id: str = Field(..., description="ID del Record asociado")
    requested_by_id: str = Field(..., description="ID del usuario que solicitó la generación")

    # Output de IA
    ai_output: dict[str, Any] = Field(..., description="JSON estructurado retornado por el proveedor IA")
    ai_input_schema: dict[str, Any] = Field(
        default_factory=dict,
        description="Schema de entrada usado para generar la minuta",
    )
    derived_fields: dict[str, Any] = Field(
        default_factory=dict,
        description="Campos derivados determinísticamente por el worker a partir del input/adjuntos",
    )
    ai_provider: str = Field(..., description="Proveedor IA efectivo usado por el worker")
    ai_model: str = Field(..., description="Modelo IA efectivo usado por el worker")
    ai_provider_config_id: str | None = Field(None, description="ID de la configuración AI activa usada por el worker")
    ai_provider_name: str | None = Field(None, description="Nombre de la configuración AI activa usada por el worker")
    ai_provider_family: str | None = Field(None, description="Familia/protocolo del proveedor")
    ai_execution_adapter: str | None = Field(None, description="Adapter de ejecución usado por el worker")
    openai_run_id: str = Field(..., description="ID del run de OpenAI (chatcmpl-xxx)")
    tokens_input: int = Field(..., ge=0, description="Tokens consumidos en el prompt")
    tokens_output: int = Field(..., ge=0, description="Tokens generados en la respuesta")
    started_at: datetime | None = Field(None, description="Instante de inicio efectivo de la llamada al proveedor")
    finished_at: datetime | None = Field(None, description="Instante de fin efectivo de la llamada al proveedor")
    latency_ms: int | None = Field(None, ge=0, description="Duración total de la llamada al proveedor en milisegundos")

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


class MinuteFailRequest(BaseModel):
    """
    Payload que envía el worker al backend cuando detecta un fallo terminal
    que no debe reintentarse.
    """
    transaction_id: str = Field(..., description="ID de MinuteTransaction (TX1)")
    record_id: str = Field(..., description="ID del Record asociado")
    requested_by_id: str = Field(..., description="ID del usuario que solicitó la generación")
    error_message: str = Field(..., min_length=1, description="Mensaje de error que explica el fallo terminal")
    record_status: Literal["llm-failed", "processing-error"] = Field(
        "processing-error",
        description="Estado funcional final que debe reflejar el record",
    )
    source: str = Field("worker", description="Origen del reporte de fallo")
    ai_provider: str | None = Field(None, description="Proveedor IA resuelto para el intento fallido")
    ai_model: str | None = Field(None, description="Modelo IA resuelto para el intento fallido")
    ai_provider_config_id: str | None = Field(None, description="Configuración AI activa usada por el intento")
    ai_provider_name: str | None = Field(None, description="Nombre de la configuración AI activa usada por el intento")
    ai_provider_family: str | None = Field(None, description="Familia/protocolo del proveedor")
    ai_execution_adapter: str | None = Field(None, description="Adapter de ejecución usado por el worker")
    openai_run_id: str | None = Field(None, description="Run ID asociado si existe")
    tokens_input: int | None = Field(None, ge=0, description="Tokens de entrada observados si el proveedor alcanzó a responder")
    tokens_output: int | None = Field(None, ge=0, description="Tokens de salida observados si el proveedor alcanzó a responder")
    started_at: datetime | None = Field(None, description="Instante de inicio efectivo de la llamada al proveedor")
    finished_at: datetime | None = Field(None, description="Instante de fin efectivo de la llamada al proveedor")
    latency_ms: int | None = Field(None, ge=0, description="Duración total del intento de llamada al proveedor")

    model_config = {"populate_by_name": True}


class MinuteFailResponse(BaseModel):
    """
    Confirmación del backend tras marcar una minuta como fallida.
    """
    ok: bool = True
    record_id: str
    transaction_id: str
    tx_status: str = "failed"
    record_status: str
    message: str = "Fallo terminal registrado"

    model_config = {"populate_by_name": True}


class MinuteOfficializedEmailRequest(BaseModel):
    record_id: str = Field(..., alias="recordId", description="ID del record/minuta")
    actor_user_id: str | None = Field(None, alias="actorUserId", description="Usuario responsable que dispara el envío")

    model_config = {"populate_by_name": True}


class MinuteOfficializedEmailResponse(BaseModel):
    ok: bool = True
    record_id: str = Field(..., alias="recordId")
    queued: bool
    message: str

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

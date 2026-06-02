# schemas/internal_context.py
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ContextMinuteCanonicalResponse(BaseModel):
    ok: bool = True
    record_id: str = Field(..., serialization_alias="recordId")
    version_id: str = Field(..., serialization_alias="versionId")
    schema_version: str = Field(..., serialization_alias="schemaVersion")
    source_hash: str = Field(..., serialization_alias="sourceHash")
    canonical: dict[str, Any]

    model_config = {"populate_by_name": True}


class ContextIndexJobStatusResponse(BaseModel):
    ok: bool = True
    job_id: str = Field(..., serialization_alias="jobId")
    document_id: str | None = Field(None, serialization_alias="documentId")
    status: str

    model_config = {"populate_by_name": True}


class ContextIndexedChunkRequest(BaseModel):
    id: str
    source_item_id: str = Field(..., alias="sourceItemId")
    item_type: str = Field(..., alias="itemType")
    chunk_index: int = Field(..., alias="chunkIndex", ge=0)
    chunk_hash: str = Field(..., alias="chunkHash")
    qdrant_point_id: str = Field(..., alias="qdrantPointId")

    model_config = {"populate_by_name": True}


class ContextIndexJobCompleteRequest(BaseModel):
    document_id: str = Field(..., alias="documentId")
    source_hash: str = Field(..., alias="sourceHash")
    embedding_provider_config_id: str = Field(..., alias="embeddingProviderConfigId")
    embedding_binding_id: str | None = Field(None, alias="embeddingBindingId")
    embedding_model: str = Field(..., alias="embeddingModel")
    embedding_dimensions: int = Field(..., alias="embeddingDimensions", ge=1)
    qdrant_collection: str = Field(..., alias="qdrantCollection")
    chunks: list[ContextIndexedChunkRequest] = Field(default_factory=list)
    input_tokens: int | None = Field(None, alias="inputTokens", ge=0)
    output_tokens: int | None = Field(None, alias="outputTokens", ge=0)
    provider_usage_raw_json: dict | list | None = Field(None, alias="providerUsageRawJson")
    provider_meta_json: dict | list | None = Field(None, alias="providerMetaJson")

    model_config = {"populate_by_name": True}


class ContextCleanupJobCompleteRequest(BaseModel):
    document_id: str | None = Field(None, alias="documentId")
    record_id: str = Field(..., alias="recordId")
    version_id: str | None = Field(None, alias="versionId")
    collections: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class ContextIndexJobFailRequest(BaseModel):
    document_id: str | None = Field(None, alias="documentId")
    error: str = Field(..., min_length=1)
    retryable: bool = True

    model_config = {"populate_by_name": True}

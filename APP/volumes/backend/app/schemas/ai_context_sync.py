from __future__ import annotations

from pydantic import BaseModel, Field

AI_CONTEXT_DOCUMENT_STATUSES = {
    "not_indexed",
    "queued",
    "indexing",
    "synced",
    "outdated",
    "failed",
    "disabled",
    "deleted_from_index",
}

AI_CONTEXT_JOB_STATUSES = {
    "queued",
    "running",
    "succeeded",
    "retrying",
    "failed",
    "cancelled",
}

AI_CONTEXT_QUERY_STATUSES = {
    "queued",
    "running",
    "succeeded",
    "failed",
    "insufficient_context",
}


class AiContextDocumentResponse(BaseModel):
    id: str
    source_system: str = Field(..., serialization_alias="sourceSystem")
    source_client_id: str = Field(..., serialization_alias="sourceClientId")
    source_project_id: str | None = Field(None, serialization_alias="sourceProjectId")
    source_minute_id: str = Field(..., serialization_alias="sourceMinuteId")
    source_version_id: str = Field(..., serialization_alias="sourceVersionId")
    source_version_num: int = Field(..., serialization_alias="sourceVersionNum")
    status: str
    source_hash: str | None = Field(None, serialization_alias="sourceHash")
    indexed_hash: str | None = Field(None, serialization_alias="indexedHash")
    embedding_model: str | None = Field(None, serialization_alias="embeddingModel")
    embedding_dimensions: int | None = Field(None, serialization_alias="embeddingDimensions")
    qdrant_collection: str | None = Field(None, serialization_alias="qdrantCollection")
    chunk_count: int = Field(..., serialization_alias="chunkCount")
    last_error: str | None = Field(None, serialization_alias="lastError")
    indexed_at: str | None = Field(None, serialization_alias="indexedAt")
    last_checked_at: str | None = Field(None, serialization_alias="lastCheckedAt")

    model_config = {"populate_by_name": True}


class AiContextSyncStatusResponse(BaseModel):
    total_documents: int = Field(..., serialization_alias="totalDocuments")
    by_status: dict[str, int] = Field(..., serialization_alias="byStatus")
    failed_documents: int = Field(..., serialization_alias="failedDocuments")
    outdated_documents: int = Field(..., serialization_alias="outdatedDocuments")
    not_indexed_documents: int = Field(..., serialization_alias="notIndexedDocuments")

    model_config = {"populate_by_name": True}


from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ContextQueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    scope_type: Literal["global", "client", "project", "minute"] = Field("global", alias="scopeType")
    client_id: str | None = Field(None, alias="clientId")
    project_id: str | None = Field(None, alias="projectId")
    minute_id: str | None = Field(None, alias="minuteId")
    top_k: int | None = Field(None, alias="topK", ge=1, le=30)

    model_config = {"populate_by_name": True}


class ContextCitation(BaseModel):
    chunk_id: str = Field(..., alias="chunkId")
    minute_id: str = Field(..., alias="minuteId")
    version_id: str = Field(..., alias="versionId")
    item_type: str = Field(..., alias="itemType")
    source_item_id: str = Field(..., alias="sourceItemId")
    score: float | None = None
    title: str | None = None
    text: str

    model_config = {"populate_by_name": True}


class ContextQueryResponse(BaseModel):
    ok: bool = True
    query_id: str = Field(..., alias="queryId")
    status: str
    answer: str | None = None
    citations: list[ContextCitation] = Field(default_factory=list)
    message: str | None = None

    model_config = {"populate_by_name": True}


class ContextSyncMinuteItem(BaseModel):
    document_id: str | None = Field(None, alias="documentId")
    minute_id: str = Field(..., alias="minuteId")
    version_id: str = Field(..., alias="versionId")
    version_num: int = Field(..., alias="versionNum")
    client_id: str = Field(..., alias="clientId")
    client_name: str | None = Field(None, alias="clientName")
    project_id: str | None = Field(None, alias="projectId")
    project_name: str | None = Field(None, alias="projectName")
    title: str
    status: str
    source_hash: str | None = Field(None, alias="sourceHash")
    indexed_hash: str | None = Field(None, alias="indexedHash")
    chunk_count: int = Field(0, alias="chunkCount")
    last_error: str | None = Field(None, alias="lastError")
    indexed_at: str | None = Field(None, alias="indexedAt")
    last_checked_at: str | None = Field(None, alias="lastCheckedAt")

    model_config = {"populate_by_name": True}


class ContextSyncMinutesResponse(BaseModel):
    items: list[ContextSyncMinuteItem]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}


class ContextSyncStatusResponse(BaseModel):
    total_documents: int = Field(..., alias="totalDocuments")
    by_status: dict[str, int] = Field(..., alias="byStatus")
    failed_documents: int = Field(..., alias="failedDocuments")
    outdated_documents: int = Field(..., alias="outdatedDocuments")
    not_indexed_documents: int = Field(..., alias="notIndexedDocuments")

    model_config = {"populate_by_name": True}


class ContextQdrantHealthResponse(BaseModel):
    ok: bool
    status: str
    url: str | None = None
    collections_count: int = Field(0, alias="collectionsCount")
    message: str
    checked_at: str = Field(..., alias="checkedAt")

    model_config = {"populate_by_name": True}


class ContextSyncActionResponse(BaseModel):
    ok: bool = True
    queued: int = 0
    skipped: int = 0
    message: str

    model_config = {"populate_by_name": True}

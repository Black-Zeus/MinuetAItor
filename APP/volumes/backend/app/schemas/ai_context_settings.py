from __future__ import annotations

from pydantic import BaseModel, Field

from schemas.system_maintenance import UserRefResponse


class AiContextSettingsRequest(BaseModel):
    context_ai_enabled: bool = Field(..., alias="contextAiEnabled", serialization_alias="contextAiEnabled")
    query_enabled: bool = Field(..., alias="queryEnabled", serialization_alias="queryEnabled")
    indexing_enabled: bool = Field(..., alias="indexingEnabled", serialization_alias="indexingEnabled")
    sync_enabled: bool = Field(..., alias="syncEnabled", serialization_alias="syncEnabled")

    model_config = {"populate_by_name": True}


class AiContextSettingsResponse(BaseModel):
    id: int
    context_ai_enabled: bool = Field(..., serialization_alias="contextAiEnabled")
    query_enabled: bool = Field(..., serialization_alias="queryEnabled")
    indexing_enabled: bool = Field(..., serialization_alias="indexingEnabled")
    sync_enabled: bool = Field(..., serialization_alias="syncEnabled")
    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")

    model_config = {"populate_by_name": True}


class AiContextAvailabilityResponse(BaseModel):
    context_ai_enabled: bool = Field(..., serialization_alias="contextAiEnabled")
    query_enabled: bool = Field(..., serialization_alias="queryEnabled")
    available: bool

    model_config = {"populate_by_name": True}

# schemas/record_artifacts.py
from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class RecordArtifactCreateRequest(BaseModel):
    record_id: str
    record_version_id: str | None = None
    is_draft: bool = False

    artifact_type_id: int
    artifact_state_id: int

    object_id: str
    natural_name: str | None = None

    model_config = {"populate_by_name": True}


class RecordArtifactUpdateRequest(BaseModel):
    record_id: str | None = None
    record_version_id: str | None = None
    is_draft: bool | None = None

    artifact_type_id: int | None = None
    artifact_state_id: int | None = None

    object_id: str | None = None
    natural_name: str | None = None

    model_config = {"populate_by_name": True}


class RecordArtifactFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    record_id: str | None = None
    record_version_id: str | None = None
    object_id: str | None = None

    artifact_type_id: int | None = None
    artifact_state_id: int | None = None

    is_draft: bool | None = None
    include_deleted: bool = False

    model_config = {"populate_by_name": True}


class RecordArtifactResponse(BaseModel):
    id: int

    record_id: str = Field(..., serialization_alias="recordId")
    record_version_id: str | None = Field(None, serialization_alias="recordVersionId")
    is_draft: bool = Field(..., serialization_alias="isDraft")

    artifact_type_id: int = Field(..., serialization_alias="artifactTypeId")
    artifact_state_id: int = Field(..., serialization_alias="artifactStateId")

    object_id: str = Field(..., serialization_alias="objectId")
    natural_name: str | None = Field(None, serialization_alias="naturalName")

    created_at: str | None = Field(None, serialization_alias="createdAt")
    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")

    deleted_at: str | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class RecordArtifactListResponse(BaseModel):
    items: list[RecordArtifactResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
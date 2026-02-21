# schemas/record_type_artifact_types.py

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class EntityRefResponse(BaseModel):
    id: int
    code: str | None = None
    name: str | None = None

    model_config = {"populate_by_name": True}


class RecordTypeArtifactTypesCreateRequest(BaseModel):
    record_type_id: int = Field(..., ge=1)
    artifact_type_id: int = Field(..., ge=1)
    is_required_on_publish: bool = False
    max_count: int = Field(1, ge=1)
    is_active: bool = True

    model_config = {"populate_by_name": True}


class RecordTypeArtifactTypesUpdateRequest(BaseModel):
    is_required_on_publish: bool | None = None
    max_count: int | None = Field(None, ge=1)
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class RecordTypeArtifactTypesStatusRequest(BaseModel):
    record_type_id: int = Field(..., ge=1)
    artifact_type_id: int = Field(..., ge=1)
    is_active: bool

    model_config = {"populate_by_name": True}


class RecordTypeArtifactTypesFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None

    record_type_id: int | None = Field(None, ge=1)
    artifact_type_id: int | None = Field(None, ge=1)
    is_required_on_publish: bool | None = None

    model_config = {"populate_by_name": True}


class RecordTypeArtifactTypesResponse(BaseModel):
    record_type_id: int = Field(..., serialization_alias="recordTypeId")
    artifact_type_id: int = Field(..., serialization_alias="artifactTypeId")

    is_required_on_publish: bool = Field(..., serialization_alias="isRequiredOnPublish")
    max_count: int = Field(..., serialization_alias="maxCount")
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: datetime = Field(..., serialization_alias="createdAt")
    updated_at: datetime | None = Field(None, serialization_alias="updatedAt")

    deleted_at: datetime | None = Field(None, serialization_alias="deletedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    record_type: EntityRefResponse | None = Field(None, serialization_alias="recordType")
    artifact_type: EntityRefResponse | None = Field(None, serialization_alias="artifactType")

    model_config = {"populate_by_name": True}


class RecordTypeArtifactTypesListResponse(BaseModel):
    items: list[RecordTypeArtifactTypesResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class ArtifactTypeMimeTypeCreateRequest(BaseModel):
    artifact_type_id: int = Field(..., ge=0, serialization_alias="artifactTypeId")
    mime_type_id: int = Field(..., ge=0, serialization_alias="mimeTypeId")

    is_default: bool = Field(False, serialization_alias="isDefault")
    is_active: bool = Field(True, serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class ArtifactTypeMimeTypeUpdateRequest(BaseModel):
    is_default: bool | None = Field(None, serialization_alias="isDefault")
    is_active: bool | None = Field(None, serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class ArtifactTypeMimeTypeStatusRequest(BaseModel):
    artifact_type_id: int = Field(..., ge=0, serialization_alias="artifactTypeId")
    mime_type_id: int = Field(..., ge=0, serialization_alias="mimeTypeId")
    is_active: bool = Field(..., serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class ArtifactTypeMimeTypeFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    artifact_type_id: int | None = Field(None, ge=0, serialization_alias="artifactTypeId")
    mime_type_id: int | None = Field(None, ge=0, serialization_alias="mimeTypeId")
    is_default: bool | None = Field(None, serialization_alias="isDefault")
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class ArtifactTypeMimeTypeResponse(BaseModel):
    artifact_type_id: int = Field(..., serialization_alias="artifactTypeId")
    mime_type_id: int = Field(..., serialization_alias="mimeTypeId")

    is_default: bool = Field(..., serialization_alias="isDefault")
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: str = Field(..., serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    deleted_at: str | None = Field(None, serialization_alias="deletedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class ArtifactTypeMimeTypeListResponse(BaseModel):
    items: list[ArtifactTypeMimeTypeResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
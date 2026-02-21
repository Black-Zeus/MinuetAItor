from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class FileExtensionCreateRequest(BaseModel):
    ext: str = Field(..., min_length=1, max_length=20)
    description: str | None = Field(None, max_length=255)
    is_active: bool = True

    model_config = {"populate_by_name": True}


class FileExtensionUpdateRequest(BaseModel):
    ext: str | None = Field(None, min_length=1, max_length=20)
    description: str | None = Field(None, max_length=255)
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class FileExtensionStatusRequest(BaseModel):
    id: int
    is_active: bool = Field(..., serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class FileExtensionFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None
    ext: str | None = Field(None, max_length=20)

    model_config = {"populate_by_name": True}


class FileExtensionResponse(BaseModel):
    id: int
    ext: str
    description: str | None = None
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: datetime | None = Field(None, serialization_alias="createdAt")
    updated_at: datetime | None = Field(None, serialization_alias="updatedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")
    deleted_at: datetime | None = Field(None, serialization_alias="deletedAt")

    model_config = {"populate_by_name": True}


class FileExtensionListResponse(BaseModel):
    items: list[FileExtensionResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
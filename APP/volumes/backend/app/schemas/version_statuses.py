# schemas/version_statuses.py

from __future__ import annotations

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class VersionStatusCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = Field(None, max_length=255)
    is_active: bool = True

    model_config = {"populate_by_name": True}


class VersionStatusUpdateRequest(BaseModel):
    code: str | None = Field(None, min_length=1, max_length=50)
    name: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = Field(None, max_length=255)
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class VersionStatusStatusRequest(BaseModel):
    is_active: bool

    model_config = {"populate_by_name": True}


class VersionStatusFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None
    q: str | None = Field(None, description="Búsqueda simple por code/name (contiene)")

    model_config = {"populate_by_name": True}


class VersionStatusResponse(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: str = Field(..., serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    deleted_at: str | None = Field(None, serialization_alias="deletedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class VersionStatusListResponse(BaseModel):
    items: list[VersionStatusResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
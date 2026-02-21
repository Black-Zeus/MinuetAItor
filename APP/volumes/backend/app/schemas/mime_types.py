# schemas/mime_types.py
from __future__ import annotations

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class MimeTypeCreateRequest(BaseModel):
    mime: str = Field(..., max_length=120)
    description: str | None = Field(None, max_length=255)
    is_active: bool = True

    model_config = {"populate_by_name": True}


class MimeTypeUpdateRequest(BaseModel):
    mime: str | None = Field(None, max_length=120)
    description: str | None = Field(None, max_length=255)
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class MimeTypeStatusRequest(BaseModel):
    id: int = Field(..., ge=1)
    is_active: bool

    model_config = {"populate_by_name": True}


class MimeTypeFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None
    mime: str | None = Field(None, max_length=120)
    q: str | None = Field(None, description="Búsqueda parcial sobre mime/description")

    model_config = {"populate_by_name": True}


class MimeTypeResponse(BaseModel):
    id: int
    mime: str
    description: str | None = None
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    deleted_at: str | None = Field(None, serialization_alias="deletedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class MimeTypeListResponse(BaseModel):
    items: list[MimeTypeResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
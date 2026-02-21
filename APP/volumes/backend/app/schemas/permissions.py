# schemas/permissions.py
from __future__ import annotations

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class PermissionCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=150)
    description: str | None = Field(None, max_length=255)
    is_active: bool = True

    model_config = {"populate_by_name": True}


class PermissionUpdateRequest(BaseModel):
    code: str | None = Field(None, min_length=1, max_length=100)
    name: str | None = Field(None, min_length=1, max_length=150)
    description: str | None = Field(None, max_length=255)
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class PermissionStatusRequest(BaseModel):
    id: int
    is_active: bool

    model_config = {"populate_by_name": True}


class PermissionFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None
    q: str | None = Field(None, description="Búsqueda por code o name (LIKE)")

    model_config = {"populate_by_name": True}


class PermissionResponse(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: str = Field(..., serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")

    deleted_at: str | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class PermissionListResponse(BaseModel):
    items: list[PermissionResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
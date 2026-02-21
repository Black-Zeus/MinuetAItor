# schemas/roles.py

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class RoleCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = Field(None, max_length=255)
    is_active: bool = True

    model_config = {"populate_by_name": True}


class RoleUpdateRequest(BaseModel):
    code: str | None = Field(None, min_length=1, max_length=50)
    name: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = Field(None, max_length=255)
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class RoleStatusRequest(BaseModel):
    is_active: bool = Field(..., serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class RoleFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = Field(None, serialization_alias="isActive")
    q: str | None = None
    code: str | None = None
    name: str | None = None

    model_config = {"populate_by_name": True}


class RoleResponse(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: datetime | None = Field(None, serialization_alias="createdAt")
    updated_at: datetime | None = Field(None, serialization_alias="updatedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")

    deleted_at: datetime | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class RoleListResponse(BaseModel):
    items: list[RoleResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
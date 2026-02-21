# schemas/projects.py
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class ProjectCreateRequest(BaseModel):
    client_id: str
    name: str
    code: str | None = None
    description: str | None = None
    status: str = "activo"
    is_confidential: bool = False
    is_active: bool = True

    model_config = {"populate_by_name": True}


class ProjectUpdateRequest(BaseModel):
    client_id: str | None = None
    name: str | None = None
    code: str | None = None
    description: str | None = None
    status: str | None = None
    is_confidential: bool | None = None
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class ProjectStatusRequest(BaseModel):
    id: str
    is_active: bool

    model_config = {"populate_by_name": True}


class ProjectFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    client_id: str | None = None
    q: str | None = None
    status: str | None = None
    is_confidential: bool | None = None

    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class ProjectResponse(BaseModel):
    id: str
    client_id: str = Field(..., serialization_alias="clientId")

    name: str
    code: str | None = None
    description: str | None = None
    status: str

    is_confidential: bool = Field(..., serialization_alias="isConfidential")
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: str = Field(..., serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_at: str | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}

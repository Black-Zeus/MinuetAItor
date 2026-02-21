# schemas/user_roles.py
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class RoleRefResponse(BaseModel):
    id: int
    code: str | None = None
    name: str | None = None

    model_config = {"populate_by_name": True}


class UserRoleCreateRequest(BaseModel):
    user_id: str = Field(..., min_length=36, max_length=36)
    role_id: int = Field(..., ge=1)

    model_config = {"populate_by_name": True}


class UserRoleUpdateRequest(BaseModel):
    # Tabla pivote: no hay campos mutables reales; se usa para operación idempotente/restore.
    # Se mantiene para respetar el contrato PUT del proyecto.
    model_config = {"populate_by_name": True}


class UserRoleFilterRequest(BaseModel):
    user_id: str | None = Field(None, min_length=36, max_length=36)
    role_id: int | None = Field(None, ge=1)

    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    model_config = {"populate_by_name": True}


class UserRoleResponse(BaseModel):
    user_id: str = Field(..., serialization_alias="userId")
    role_id: int = Field(..., serialization_alias="roleId")

    created_at: str | None = Field(None, serialization_alias="createdAt")
    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")

    deleted_at: str | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    user: UserRefResponse | None = None
    role: RoleRefResponse | None = None

    model_config = {"populate_by_name": True}


class UserRoleListResponse(BaseModel):
    items: list[UserRoleResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
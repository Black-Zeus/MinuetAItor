# schemas/role_permissions.py
from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class RoleMiniResponse(BaseModel):
    id: int
    code: str | None = None
    name: str | None = None
    is_active: bool | None = Field(None, serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class PermissionMiniResponse(BaseModel):
    id: int
    code: str | None = None
    name: str | None = None
    is_active: bool | None = Field(None, serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class RolePermissionCreateRequest(BaseModel):
    role_id: int = Field(..., ge=1)
    permission_id: int = Field(..., ge=1)

    model_config = {"populate_by_name": True}


class RolePermissionUpdateRequest(BaseModel):
    # No hay campos “editables” reales en una tabla de unión;
    # se deja para cumplir el contrato PUT (operación idempotente de "restore" opcional).
    restore: bool | None = None

    model_config = {"populate_by_name": True}


class RolePermissionFilterRequest(BaseModel):
    role_id: int | None = Field(None, ge=1)
    permission_id: int | None = Field(None, ge=1)
    include_deleted: bool = False

    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    model_config = {"populate_by_name": True}


class RolePermissionResponse(BaseModel):
    role_id: int = Field(..., serialization_alias="roleId")
    permission_id: int = Field(..., serialization_alias="permissionId")

    created_at: str = Field(..., serialization_alias="createdAt")
    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")

    deleted_at: str | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    # Opcional (si existe info en Role/Permission)
    role: RoleMiniResponse | None = None
    permission: PermissionMiniResponse | None = None

    model_config = {"populate_by_name": True}


class RolePermissionListResponse(BaseModel):
    items: list[RolePermissionResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
# schemas/user_project_acl.py

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class UserProjectPermissionEnum(str, Enum):
    read = "read"
    edit = "edit"
    owner = "owner"


class UserProjectACLCreateRequest(BaseModel):
    user_id: str
    project_id: str
    permission: UserProjectPermissionEnum = UserProjectPermissionEnum.read
    is_active: bool = True

    model_config = {"populate_by_name": True}


class UserProjectACLUpdateRequest(BaseModel):
    permission: UserProjectPermissionEnum | None = None
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class UserProjectACLStatusRequest(BaseModel):
    is_active: bool

    model_config = {"populate_by_name": True}


class UserProjectACLFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    user_id: str | None = None
    project_id: str | None = None
    permission: UserProjectPermissionEnum | None = None
    is_active: bool | None = None  # None=todos, True=activos, False=inactivos

    model_config = {"populate_by_name": True}


class UserProjectACLResponse(BaseModel):
    user_id: str = Field(..., serialization_alias="userId")
    project_id: str = Field(..., serialization_alias="projectId")

    permission: UserProjectPermissionEnum
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_at: str | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class UserProjectACLListResponse(BaseModel):
    items: list[UserProjectACLResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
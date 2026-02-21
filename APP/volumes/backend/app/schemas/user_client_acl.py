# schemas/user_client_acl.py
from __future__ import annotations

import enum
from datetime import datetime
from pydantic import BaseModel, Field


class UserClientAclPermission(str, enum.Enum):
    read = "read"
    edit = "edit"
    owner = "owner"


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class UserClientAclCreateRequest(BaseModel):
    user_id: str = Field(..., min_length=36, max_length=36)
    client_id: str = Field(..., min_length=36, max_length=36)
    permission: UserClientAclPermission = UserClientAclPermission.read
    is_active: bool = True

    model_config = {"populate_by_name": True}


class UserClientAclUpdateRequest(BaseModel):
    permission: UserClientAclPermission | None = None
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class UserClientAclStatusRequest(BaseModel):
    user_id: str = Field(..., min_length=36, max_length=36)
    client_id: str = Field(..., min_length=36, max_length=36)
    is_active: bool

    model_config = {"populate_by_name": True}


class UserClientAclFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    user_id: str | None = None
    client_id: str | None = None
    permission: UserClientAclPermission | None = None
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class UserClientAclResponse(BaseModel):
    user_id: str = Field(..., serialization_alias="userId")
    client_id: str = Field(..., serialization_alias="clientId")
    permission: UserClientAclPermission
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: datetime = Field(..., serialization_alias="createdAt")
    updated_at: datetime | None = Field(None, serialization_alias="updatedAt")
    deleted_at: datetime | None = Field(None, serialization_alias="deletedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class UserClientAclListResponse(BaseModel):
    items: list[UserClientAclResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
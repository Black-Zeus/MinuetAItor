# schemas/user_clients.py
from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class UserClientCreateRequest(BaseModel):
    user_id: str
    client_id: str
    is_active: bool = True

    model_config = {"populate_by_name": True}


class UserClientUpdateRequest(BaseModel):
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class UserClientStatusRequest(BaseModel):
    user_id: str
    client_id: str
    is_active: bool

    model_config = {"populate_by_name": True}


class UserClientFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None
    user_id: str | None = None
    client_id: str | None = None

    model_config = {"populate_by_name": True}


class UserClientResponse(BaseModel):
    user_id: str = Field(..., serialization_alias="userId")
    client_id: str = Field(..., serialization_alias="clientId")
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    deleted_at: str | None = Field(None, serialization_alias="deletedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class UserClientListResponse(BaseModel):
    items: List[UserClientResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
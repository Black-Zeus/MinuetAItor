# schemas/clients.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ClientCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=600)
    industry: Optional[str] = Field(None, max_length=120)
    is_confidential: bool = False
    is_active: bool = True

    model_config = {"populate_by_name": True}


class ClientUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=600)
    industry: Optional[str] = Field(None, max_length=120)
    is_confidential: Optional[bool] = None
    is_active: Optional[bool] = None

    model_config = {"populate_by_name": True}


class ClientStatusRequest(BaseModel):
    is_active: bool

    model_config = {"populate_by_name": True}


class ClientFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    name: Optional[str] = None
    code: Optional[str] = None
    industry: Optional[str] = None
    is_confidential: Optional[bool] = None

    is_active: Optional[bool] = None  # None=all, True=activos, False=inactivos

    model_config = {"populate_by_name": True}


class UserRefResponse(BaseModel):
    id: str
    username: Optional[str] = None
    full_name: Optional[str] = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class ClientResponse(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None

    is_confidential: bool = Field(..., serialization_alias="isConfidential")
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: Optional[datetime] = Field(None, serialization_alias="createdAt")
    updated_at: Optional[datetime] = Field(None, serialization_alias="updatedAt")

    created_by: Optional[UserRefResponse] = Field(None, serialization_alias="createdBy")
    updated_by: Optional[UserRefResponse] = Field(None, serialization_alias="updatedBy")
    deleted_at: Optional[datetime] = Field(None, serialization_alias="deletedAt")
    deleted_by: Optional[UserRefResponse] = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class ClientListResponse(BaseModel):
    items: list[ClientResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}

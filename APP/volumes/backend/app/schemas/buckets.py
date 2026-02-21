# schemas/buckets.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class BucketCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=80)
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=255)
    is_active: bool = True

    model_config = {"populate_by_name": True}


class BucketUpdateRequest(BaseModel):
    code: str | None = Field(None, min_length=1, max_length=80)
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=255)
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class BucketStatusRequest(BaseModel):
    is_active: bool

    model_config = {"populate_by_name": True}


class BucketFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None
    code: str | None = Field(None, max_length=80)
    name: str | None = Field(None, max_length=200)
    q: str | None = Field(None, max_length=200)

    model_config = {"populate_by_name": True}


class BucketResponse(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")

    deleted_at: str | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class BucketListResponse(BaseModel):
    items: list[BucketResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
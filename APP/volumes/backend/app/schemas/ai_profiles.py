# schemas/ai_profiles.py
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class AiProfileCreateRequest(BaseModel):
    category_id: int
    name: str
    description: str | None = None
    prompt: str
    is_active: bool = True

    model_config = {"populate_by_name": True}


class AiProfileUpdateRequest(BaseModel):
    category_id: int | None = None
    name: str | None = None
    description: str | None = None
    prompt: str | None = None
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class AiProfileStatusRequest(BaseModel):
    id: str
    is_active: bool = Field(..., serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class AiProfileFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None

    category_id: int | None = None
    q: str | None = None  # búsqueda por name/description (LIKE)

    model_config = {"populate_by_name": True}


class AiProfileCategoryRefResponse(BaseModel):
    id: int
    name: str | None = None

    model_config = {"populate_by_name": True}


class AiProfileResponse(BaseModel):
    id: str
    category_id: int = Field(..., serialization_alias="categoryId")
    category: AiProfileCategoryRefResponse | None = None

    name: str
    description: str | None = None
    prompt: str
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: datetime | None = Field(None, serialization_alias="createdAt")
    updated_at: datetime | None = Field(None, serialization_alias="updatedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_at: datetime | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class AiProfileListResponse(BaseModel):
    items: list[AiProfileResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}

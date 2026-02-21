# schemas/ai_profile_categories.py
from __future__ import annotations

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class AiProfileCategoryCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    is_active: bool = True

    model_config = {"populate_by_name": True}


class AiProfileCategoryUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class AiProfileCategoryStatusRequest(BaseModel):
    is_active: bool

    model_config = {"populate_by_name": True}


class AiProfileCategoryFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)
    is_active: bool | None = None
    name: str | None = Field(None, description="Filtro parcial por nombre (ILIKE/LIKE)")

    model_config = {"populate_by_name": True}


class AiProfileCategoryResponse(BaseModel):
    id: int
    name: str
    is_active: bool = Field(..., serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class AiProfileCategoryListResponse(BaseModel):
    items: list[AiProfileCategoryResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}

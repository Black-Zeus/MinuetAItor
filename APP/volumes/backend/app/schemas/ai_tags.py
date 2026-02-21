# schemas/ai_tags.py
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class AITagCreateRequest(BaseModel):
    slug: str
    description: str | None = None
    is_active: bool = True

    model_config = {"populate_by_name": True}


class AITagUpdateRequest(BaseModel):
    slug: str | None = None
    description: str | None = None
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class AITagStatusRequest(BaseModel):
    is_active: bool

    model_config = {"populate_by_name": True}


class AITagFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None
    slug: str | None = None

    model_config = {"populate_by_name": True}


class AITagResponse(BaseModel):
    id: str
    slug: str
    description: str | None = None
    is_active: bool = Field(..., serialization_alias="isActive")
    created_at: str = Field(..., serialization_alias="createdAt")

    model_config = {"populate_by_name": True}


class AITagListResponse(BaseModel):
    items: list[AITagResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}

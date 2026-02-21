# schemas/tags.py
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class TagSourceEnum(str, Enum):
    user = "user"
    ai = "ai"


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class TagCreateRequest(BaseModel):
    category_id: int
    name: str
    description: str | None = None
    source: TagSourceEnum = TagSourceEnum.user
    status: str = "activo"
    is_active: bool = True

    model_config = {"populate_by_name": True}


class TagUpdateRequest(BaseModel):
    category_id: int | None = None
    name: str | None = None
    description: str | None = None
    source: TagSourceEnum | None = None
    status: str | None = None
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class TagStatusRequest(BaseModel):
    is_active: bool

    model_config = {"populate_by_name": True}


class TagFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None

    category_id: int | None = None
    source: TagSourceEnum | None = None
    status: str | None = None
    name: str | None = None

    model_config = {"populate_by_name": True}


class TagResponse(BaseModel):
    id: str

    category_id: int = Field(..., serialization_alias="categoryId")
    name: str
    description: str | None = None
    source: TagSourceEnum
    status: str
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: str = Field(..., serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    deleted_at: str | None = Field(None, serialization_alias="deletedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class TagListResponse(BaseModel):
    items: list[TagResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}

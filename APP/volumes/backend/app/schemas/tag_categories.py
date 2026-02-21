# schemas/tag_categories.py

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class TagCategoryCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    is_active: bool = True

    model_config = {"populate_by_name": True}


class TagCategoryUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class TagCategoryStatusRequest(BaseModel):
    is_active: bool

    model_config = {"populate_by_name": True}


class TagCategoryFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None
    q: str | None = Field(None, description="Búsqueda parcial por nombre")

    model_config = {"populate_by_name": True}


class TagCategoryResponse(BaseModel):
    id: int
    name: str
    is_active: bool = Field(..., serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class TagCategoryListResponse(BaseModel):
    items: list[TagCategoryResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}

# schemas/dashboard_widgets.py

from __future__ import annotations

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class DashboardWidgetCreateRequest(BaseModel):
    code: str
    name: str
    description: str | None = None
    is_active: bool = True

    model_config = {"populate_by_name": True}


class DashboardWidgetUpdateRequest(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class DashboardWidgetStatusRequest(BaseModel):
    id: int
    is_active: bool

    model_config = {"populate_by_name": True}


class DashboardWidgetFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    is_active: bool | None = None
    code: str | None = None
    name: str | None = None

    model_config = {"populate_by_name": True}


class DashboardWidgetResponse(BaseModel):
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


class DashboardWidgetListResponse(BaseModel):
    items: list[DashboardWidgetResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}

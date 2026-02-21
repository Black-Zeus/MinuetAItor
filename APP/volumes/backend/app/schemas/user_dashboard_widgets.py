# schemas/user_dashboard_widgets.py
from __future__ import annotations

from pydantic import BaseModel, Field, ConfigDict


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")
    model_config = ConfigDict(populate_by_name=True)


class DashboardWidgetRefResponse(BaseModel):
    id: int
    code: str | None = None
    name: str | None = None
    model_config = ConfigDict(populate_by_name=True)


class UserDashboardWidgetCreateRequest(BaseModel):
    user_id: str
    widget_id: int
    enabled: bool = True
    sort_order: int | None = None
    model_config = ConfigDict(populate_by_name=True)


class UserDashboardWidgetUpdateRequest(BaseModel):
    enabled: bool | None = None
    sort_order: int | None = None
    model_config = ConfigDict(populate_by_name=True)


class UserDashboardWidgetStatusRequest(BaseModel):
    enabled: bool
    model_config = ConfigDict(populate_by_name=True)


class UserDashboardWidgetFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    user_id: str | None = None
    widget_id: int | None = None
    enabled: bool | None = None

    model_config = ConfigDict(populate_by_name=True)


class UserDashboardWidgetResponse(BaseModel):
    user_id: str = Field(..., serialization_alias="userId")
    widget_id: int = Field(..., serialization_alias="widgetId")
    enabled: bool
    sort_order: int | None = Field(None, serialization_alias="sortOrder")

    user: UserRefResponse | None = None
    widget: DashboardWidgetRefResponse | None = None

    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_at: str | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = ConfigDict(populate_by_name=True)


class UserDashboardWidgetListResponse(BaseModel):
    items: list[UserDashboardWidgetResponse]
    total: int
    skip: int
    limit: int
    model_config = ConfigDict(populate_by_name=True)
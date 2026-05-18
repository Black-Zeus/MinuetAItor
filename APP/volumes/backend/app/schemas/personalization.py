from __future__ import annotations

from pydantic import BaseModel, Field


class UserPersonalizationWidgetResponse(BaseModel):
    code: str
    enabled: bool
    sort_order: int | None = Field(None, serialization_alias="sortOrder")

    model_config = {"populate_by_name": True}


class UserPersonalizationResponse(BaseModel):
    theme: str
    density: str
    animations: bool
    sidebar_collapsed: bool = Field(..., serialization_alias="sidebarCollapsed")
    dashboard_widgets: list[UserPersonalizationWidgetResponse] = Field(
        default_factory=list,
        serialization_alias="dashboardWidgets",
    )

    model_config = {"populate_by_name": True}


class UserPersonalizationWidgetUpdateRequest(BaseModel):
    code: str
    enabled: bool
    sort_order: int | None = Field(
        None,
        validation_alias="sortOrder",
        serialization_alias="sortOrder",
    )

    model_config = {"populate_by_name": True}


class UserPersonalizationUpdateRequest(BaseModel):
    theme: str | None = None
    density: str | None = None
    animations: bool | None = None
    sidebar_collapsed: bool | None = Field(
        None,
        validation_alias="sidebarCollapsed",
        serialization_alias="sidebarCollapsed",
    )
    dashboard_widgets: list[UserPersonalizationWidgetUpdateRequest] = Field(
        default_factory=list,
        validation_alias="dashboardWidgets",
        serialization_alias="dashboardWidgets",
    )

    model_config = {"populate_by_name": True}

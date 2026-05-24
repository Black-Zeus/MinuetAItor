from __future__ import annotations

from pydantic import BaseModel, Field


class DashboardMetricResponse(BaseModel):
    value: int
    change: float

    model_config = {"populate_by_name": True}


class DashboardTrendPointResponse(BaseModel):
    month: str
    label: str
    created: int
    completed: int

    model_config = {"populate_by_name": True}


class DashboardStatusPointResponse(BaseModel):
    status: str
    label: str
    value: int

    model_config = {"populate_by_name": True}


class DashboardChartsResponse(BaseModel):
    minute_trend: list[DashboardTrendPointResponse] = Field(
        default_factory=list,
        serialization_alias="minuteTrend",
    )
    status_distribution: list[DashboardStatusPointResponse] = Field(
        default_factory=list,
        serialization_alias="statusDistribution",
    )

    model_config = {"populate_by_name": True}


class DashboardStatsResponse(BaseModel):
    minutes_this_month: DashboardMetricResponse = Field(..., serialization_alias="minutesThisMonth")
    active_projects: DashboardMetricResponse = Field(..., serialization_alias="activeProjects")
    active_clients: DashboardMetricResponse = Field(..., serialization_alias="activeClients")
    charts: DashboardChartsResponse = Field(default_factory=DashboardChartsResponse)

    model_config = {"populate_by_name": True}

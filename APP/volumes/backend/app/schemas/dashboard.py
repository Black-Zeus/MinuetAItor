from __future__ import annotations

from pydantic import BaseModel, Field


class DashboardMetricResponse(BaseModel):
    value: int
    change: float

    model_config = {"populate_by_name": True}


class DashboardStatsResponse(BaseModel):
    minutes_this_month: DashboardMetricResponse = Field(..., serialization_alias="minutesThisMonth")
    active_projects: DashboardMetricResponse = Field(..., serialization_alias="activeProjects")
    active_clients: DashboardMetricResponse = Field(..., serialization_alias="activeClients")

    model_config = {"populate_by_name": True}

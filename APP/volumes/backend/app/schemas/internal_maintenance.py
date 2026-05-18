from __future__ import annotations

from pydantic import BaseModel, Field


class MaintenanceTickItemResponse(BaseModel):
    action: str
    reason: str
    job_id: str | None = Field(None, serialization_alias="jobId")

    model_config = {"populate_by_name": True}


class MaintenanceTickResponse(BaseModel):
    current_slot: str = Field(..., serialization_alias="currentSlot")
    current_time: str = Field(..., serialization_alias="currentTime")
    timezone: str
    enqueued: list[MaintenanceTickItemResponse]
    skipped: list[MaintenanceTickItemResponse]
    queue_alerts: list[dict] = Field(default_factory=list, serialization_alias="queueAlerts")

    model_config = {"populate_by_name": True}

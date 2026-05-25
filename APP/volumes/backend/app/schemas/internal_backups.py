from __future__ import annotations

from pydantic import BaseModel, Field


class BackupTickItemResponse(BaseModel):
    scope: str
    action: str | None = None
    reason: str
    job_id: str | None = Field(None, serialization_alias="jobId")

    model_config = {"populate_by_name": True}


class BackupTickResponse(BaseModel):
    current_slot: str = Field(..., serialization_alias="currentSlot")
    current_time: str = Field(..., serialization_alias="currentTime")
    timezone: str
    enqueued: list[BackupTickItemResponse]
    skipped: list[BackupTickItemResponse]

    model_config = {"populate_by_name": True}

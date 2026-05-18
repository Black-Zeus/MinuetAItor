from __future__ import annotations

from pydantic import BaseModel, Field


class SystemQueueAlertStateResponse(BaseModel):
    alert_active: bool = Field(False, serialization_alias="alertActive")
    last_alert_at: str | None = Field(None, serialization_alias="lastAlertAt")
    last_alert_size: int | None = Field(None, serialization_alias="lastAlertSize")
    last_alert_mail_sent_at: str | None = Field(None, serialization_alias="lastAlertMailSentAt")
    last_recovered_at: str | None = Field(None, serialization_alias="lastRecoveredAt")
    last_recovered_size: int | None = Field(None, serialization_alias="lastRecoveredSize")
    last_recovery_mail_sent_at: str | None = Field(None, serialization_alias="lastRecoveryMailSentAt")

    model_config = {"populate_by_name": True}


class SystemQueueItemResponse(BaseModel):
    queue: str
    label: str
    description: str
    last_activity_at: str | None = Field(None, serialization_alias="lastActivityAt")
    consumer: str
    priority: str
    size: int
    monitoring_enabled: bool = Field(..., serialization_alias="monitoringEnabled")
    warning_threshold: int = Field(..., serialization_alias="warningThreshold")
    load_percent: float = Field(..., serialization_alias="loadPercent")
    status: str
    status_label: str = Field(..., serialization_alias="statusLabel")
    status_tone: str = Field(..., serialization_alias="statusTone")
    is_warning: bool = Field(..., serialization_alias="isWarning")
    job_types: list[str] = Field(..., serialization_alias="jobTypes")
    alert_state: SystemQueueAlertStateResponse = Field(..., serialization_alias="alertState")

    model_config = {"populate_by_name": True}


class SystemQueuesStatusResponse(BaseModel):
    refreshed_at: str = Field(..., serialization_alias="refreshedAt")
    queues: list[SystemQueueItemResponse]

    model_config = {"populate_by_name": True}

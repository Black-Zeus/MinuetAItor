from __future__ import annotations

from datetime import date as dt_date, datetime as dt_datetime

from pydantic import BaseModel, Field


class ManagementEmailDeliveryReportRequest(BaseModel):
    date_from: dt_date | None = Field(None, serialization_alias="dateFrom")
    date_to: dt_date | None = Field(None, serialization_alias="dateTo")
    client: str | None = None
    project: str | None = None
    status: str | None = None
    email_kinds: list[str] | None = Field(None, serialization_alias="emailKinds")
    limit: int = Field(500, ge=1, le=1000)

    model_config = {"populate_by_name": True}


class ManagementEmailDeliveryReportRow(BaseModel):
    id: str
    job_id: str = Field(..., serialization_alias="jobId")
    status: str
    email_kind: str = Field(..., serialization_alias="emailKind")
    notification_type: str | None = Field(None, serialization_alias="notificationType")
    template_id: str | None = Field(None, serialization_alias="templateId")
    subject: str
    recipient_count: int = Field(..., serialization_alias="recipientCount")
    attachment_count: int = Field(..., serialization_alias="attachmentCount")
    inline_asset_count: int = Field(..., serialization_alias="inlineAssetCount")
    to: list[str]
    cc: list[str]
    bcc: list[str]
    scope_type: str | None = Field(None, serialization_alias="scopeType")
    scope_id: str | None = Field(None, serialization_alias="scopeId")
    record_id: str | None = Field(None, serialization_alias="recordId")
    minute_title: str = Field(..., serialization_alias="minuteTitle")
    client: str
    project: str
    actor_user_id: str | None = Field(None, serialization_alias="actorUserId")
    tags: list[str]
    attempt: int
    error_message: str | None = Field(None, serialization_alias="errorMessage")
    queued_at: dt_datetime | None = Field(None, serialization_alias="queuedAt")
    sent_at: dt_datetime | None = Field(None, serialization_alias="sentAt")
    failed_at: dt_datetime | None = Field(None, serialization_alias="failedAt")
    date: dt_datetime | None = None

    model_config = {"populate_by_name": True}


class ManagementEmailDeliveryReportResponse(BaseModel):
    items: list[ManagementEmailDeliveryReportRow]
    total: int

    model_config = {"populate_by_name": True}

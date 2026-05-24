from __future__ import annotations

from datetime import date as dt_date, datetime as dt_datetime
from typing import Literal

from pydantic import BaseModel, Field


AuditReportType = Literal[
    "user-sessions",
    "remote-session-closes",
    "password-changes",
    "available-audit-activity",
    "changes-by-entity",
    "changes-by-actor",
    "changes-by-period",
    "system-sendmail",
    "minute-otp-requests",
    "guest-sessions",
    "external-observations-evidence",
    "external-access-by-minute",
]


class AuditReportRequest(BaseModel):
    report_type: AuditReportType = Field(..., serialization_alias="reportType")
    date_from: dt_date | None = Field(None, serialization_alias="dateFrom")
    date_to: dt_date | None = Field(None, serialization_alias="dateTo")
    actor: str | None = None
    entity_type: str | None = Field(None, serialization_alias="entityType")
    status: str | None = None
    client: str | None = None
    project: str | None = None
    limit: int = Field(500, ge=1, le=1000)

    model_config = {"populate_by_name": True}


class AuditReportRow(BaseModel):
    id: str
    date: dt_datetime | None = None
    actor: str
    action: str
    entity_type: str = Field(..., serialization_alias="entityType")
    entity_id: str | None = Field(None, serialization_alias="entityId")
    status: str
    subject: str
    detail: str
    ip: str | None = None
    device: str | None = None
    location: str | None = None
    user_agent: str | None = Field(None, serialization_alias="userAgent")
    client: str | None = None
    project: str | None = None
    record_id: str | None = Field(None, serialization_alias="recordId")
    record_title: str | None = Field(None, serialization_alias="recordTitle")
    count: int = 1

    model_config = {"populate_by_name": True}


class AuditReportResponse(BaseModel):
    items: list[AuditReportRow]
    total: int

    model_config = {"populate_by_name": True}

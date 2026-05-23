from __future__ import annotations

from datetime import date as dt_date
from typing import Literal

from pydantic import BaseModel, Field


class ManagementCommitmentReportRequest(BaseModel):
    date_from: dt_date | None = Field(None, serialization_alias="dateFrom")
    date_to: dt_date | None = Field(None, serialization_alias="dateTo")
    client: str | None = None
    project: str | None = None
    limit: int = Field(300, ge=1, le=1000)

    model_config = {"populate_by_name": True}


class ManagementCommitmentReportRow(BaseModel):
    id: str
    record_id: str = Field(..., serialization_alias="recordId")
    record_version_id: str | None = Field(None, serialization_alias="recordVersionId")
    item_type: Literal["agreement", "requirement"] = Field(..., serialization_alias="itemType")
    item_code: str = Field(..., serialization_alias="itemCode")
    title: str
    body: str
    responsible: str
    status: str
    priority: str | None = None
    due_date: dt_date | None = Field(None, serialization_alias="dueDate")
    entity: str | None = None
    minute_title: str = Field(..., serialization_alias="minuteTitle")
    client: str
    project: str
    date: dt_date | None = None

    model_config = {"populate_by_name": True}


class ManagementCommitmentReportResponse(BaseModel):
    items: list[ManagementCommitmentReportRow]
    total: int

    model_config = {"populate_by_name": True}

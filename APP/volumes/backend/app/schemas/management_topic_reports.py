from __future__ import annotations

from datetime import date as dt_date
from typing import Literal

from pydantic import BaseModel, Field


TopicReportType = Literal[
    "minutes-by-tag",
    "detected-ai-tags",
    "ai-tag-conversions",
    "topic-trends",
]


class ManagementTopicReportRequest(BaseModel):
    report_type: TopicReportType = Field(..., serialization_alias="reportType")
    date_from: dt_date | None = Field(None, serialization_alias="dateFrom")
    date_to: dt_date | None = Field(None, serialization_alias="dateTo")
    client: str | None = None
    project: str | None = None
    limit: int = Field(200, ge=1, le=1000)

    model_config = {"populate_by_name": True}


class ManagementTopicReportRow(BaseModel):
    id: str
    label: str
    tag_id: str | None = Field(None, serialization_alias="tagId")
    tag: str | None = None
    ai_tag_id: str | None = Field(None, serialization_alias="aiTagId")
    ai_tag: str | None = Field(None, serialization_alias="aiTag")
    category: str | None = None
    source: str | None = None
    status_key: str | None = Field(None, serialization_alias="statusKey")
    status_label: str | None = Field(None, serialization_alias="statusLabel")
    conversion_target: str | None = Field(None, serialization_alias="conversionTarget")
    period: str | None = None
    total_records: int = Field(0, serialization_alias="totalRecords")
    total_assignments: int = Field(0, serialization_alias="totalAssignments")
    detected_count: int = Field(0, serialization_alias="detectedCount")
    converted_count: int = Field(0, serialization_alias="convertedCount")
    unconverted_count: int = Field(0, serialization_alias="unconvertedCount")
    client_count: int = Field(0, serialization_alias="clientCount")
    project_count: int = Field(0, serialization_alias="projectCount")
    conversion_rate: float = Field(0.0, serialization_alias="conversionRate")
    last_activity: dt_date | None = Field(None, serialization_alias="lastActivity")
    client: str | None = None
    project: str | None = None

    model_config = {"populate_by_name": True}


class ManagementTopicReportResponse(BaseModel):
    items: list[ManagementTopicReportRow]
    total: int

    model_config = {"populate_by_name": True}

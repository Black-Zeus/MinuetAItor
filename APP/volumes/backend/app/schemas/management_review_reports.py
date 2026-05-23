from __future__ import annotations

from datetime import date as dt_date, datetime as dt_datetime

from pydantic import BaseModel, Field


class ManagementReviewObservationRequest(BaseModel):
    date_from: dt_date | None = Field(None, serialization_alias="dateFrom")
    date_to: dt_date | None = Field(None, serialization_alias="dateTo")
    client: str | None = None
    project: str | None = None
    status: str | None = None
    limit: int = Field(500, ge=1, le=1000)

    model_config = {"populate_by_name": True}


class ManagementReviewObservationRow(BaseModel):
    id: str
    observation_id: int = Field(..., serialization_alias="observationId")
    record_id: str = Field(..., serialization_alias="recordId")
    record_version_id: str = Field(..., serialization_alias="recordVersionId")
    version_num: int | None = Field(None, serialization_alias="versionNum")
    title: str
    client: str
    project: str
    author_email: str = Field(..., serialization_alias="authorEmail")
    author_name: str | None = Field(None, serialization_alias="authorName")
    status: str
    resolution_type: str = Field(..., serialization_alias="resolutionType")
    body: str
    editor_comment: str | None = Field(None, serialization_alias="editorComment")
    created_at: dt_datetime | None = Field(None, serialization_alias="createdAt")
    resolved_at: dt_datetime | None = Field(None, serialization_alias="resolvedAt")

    model_config = {"populate_by_name": True}


class ManagementReviewObservationResponse(BaseModel):
    items: list[ManagementReviewObservationRow]
    total: int

    model_config = {"populate_by_name": True}

# schemas/record_versions.py
from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")
    model_config = {"populate_by_name": True}


class RecordRefResponse(BaseModel):
    id: str
    name: str | None = None
    title: str | None = None
    model_config = {"populate_by_name": True}


class VersionStatusRefResponse(BaseModel):
    id: int
    name: str | None = None
    code: str | None = None
    model_config = {"populate_by_name": True}


class RecordVersionCreateRequest(BaseModel):
    record_id: str
    version_num: int = Field(..., ge=1)
    status_id: int = Field(..., ge=1)

    published_at: datetime | None = None
    published_by: str

    schema_version: str = Field(..., max_length=40)
    template_version: str = Field(..., max_length=40)

    summary_text: str | None = None
    decisions_text: str | None = None
    agreements_text: str | None = None
    risks_text: str | None = None
    next_steps_text: str | None = None

    ai_provider: str | None = Field(None, max_length=40)
    ai_model: str | None = Field(None, max_length=80)
    ai_run_id: str | None = Field(None, max_length=80)

    model_config = {"populate_by_name": True}


class RecordVersionUpdateRequest(BaseModel):
    status_id: int | None = Field(None, ge=1)

    published_at: datetime | None = None
    published_by: str | None = None

    schema_version: str | None = Field(None, max_length=40)
    template_version: str | None = Field(None, max_length=40)

    summary_text: str | None = None
    decisions_text: str | None = None
    agreements_text: str | None = None
    risks_text: str | None = None
    next_steps_text: str | None = None

    ai_provider: str | None = Field(None, max_length=40)
    ai_model: str | None = Field(None, max_length=80)
    ai_run_id: str | None = Field(None, max_length=80)

    model_config = {"populate_by_name": True}


class RecordVersionFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    record_id: str | None = None
    status_id: int | None = None
    published_by: str | None = None

    schema_version: str | None = None
    template_version: str | None = None

    ai_provider: str | None = None
    ai_model: str | None = None
    ai_run_id: str | None = None

    include_deleted: bool = False

    model_config = {"populate_by_name": True}


class RecordVersionResponse(BaseModel):
    id: str

    record: RecordRefResponse | None = None
    record_id: str = Field(..., serialization_alias="recordId")

    version_num: int = Field(..., serialization_alias="versionNum")

    status: VersionStatusRefResponse | None = None
    status_id: int = Field(..., serialization_alias="statusId")

    published_at: str = Field(..., serialization_alias="publishedAt")
    published_by: UserRefResponse | None = Field(None, serialization_alias="publishedBy")

    schema_version: str = Field(..., serialization_alias="schemaVersion")
    template_version: str = Field(..., serialization_alias="templateVersion")

    summary_text: str | None = Field(None, serialization_alias="summaryText")
    decisions_text: str | None = Field(None, serialization_alias="decisionsText")
    agreements_text: str | None = Field(None, serialization_alias="agreementsText")
    risks_text: str | None = Field(None, serialization_alias="risksText")
    next_steps_text: str | None = Field(None, serialization_alias="nextStepsText")

    ai_provider: str | None = Field(None, serialization_alias="aiProvider")
    ai_model: str | None = Field(None, serialization_alias="aiModel")
    ai_run_id: str | None = Field(None, serialization_alias="aiRunId")

    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")

    deleted_at: str | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class RecordVersionListResponse(BaseModel):
    items: list[RecordVersionResponse]
    total: int
    skip: int
    limit: int
    model_config = {"populate_by_name": True}
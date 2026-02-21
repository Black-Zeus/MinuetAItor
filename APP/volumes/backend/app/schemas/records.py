# schemas/records.py

from __future__ import annotations

from datetime import date, time
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class EntityRefResponse(BaseModel):
    id: str
    name: str | None = None

    model_config = {"populate_by_name": True}


class RecordCreateRequest(BaseModel):
    client_id: str
    project_id: str | None = None

    record_type_id: int
    status_id: int

    ai_profile_id: str | None = None

    title: str
    document_date: date | None = None
    location: str | None = None

    scheduled_start_time: time | None = None
    scheduled_end_time: time | None = None
    actual_start_time: time | None = None
    actual_end_time: time | None = None

    prepared_by_user_id: str

    intro_snippet: str | None = None

    active_version_id: str | None = None
    latest_version_num: int = 0

    model_config = {"populate_by_name": True}


class RecordUpdateRequest(BaseModel):
    client_id: str | None = None
    project_id: str | None = None

    record_type_id: int | None = None
    status_id: int | None = None

    ai_profile_id: str | None = None

    title: str | None = None
    document_date: date | None = None
    location: str | None = None

    scheduled_start_time: time | None = None
    scheduled_end_time: time | None = None
    actual_start_time: time | None = None
    actual_end_time: time | None = None

    prepared_by_user_id: str | None = None

    intro_snippet: str | None = None

    active_version_id: str | None = None
    latest_version_num: int | None = None

    model_config = {"populate_by_name": True}


class RecordFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    client_id: str | None = None
    project_id: str | None = None
    record_type_id: int | None = None
    status_id: int | None = None
    ai_profile_id: str | None = None
    prepared_by_user_id: str | None = None

    title_contains: str | None = None
    location_contains: str | None = None

    document_date_from: date | None = None
    document_date_to: date | None = None

    model_config = {"populate_by_name": True}


class RecordChangeStatusRequest(BaseModel):
    status_id: int

    model_config = {"populate_by_name": True}


class RecordResponse(BaseModel):
    id: str

    client_id: str = Field(..., serialization_alias="clientId")
    project_id: str | None = Field(None, serialization_alias="projectId")

    record_type_id: int = Field(..., serialization_alias="recordTypeId")
    status_id: int = Field(..., serialization_alias="statusId")

    ai_profile_id: str | None = Field(None, serialization_alias="aiProfileId")

    title: str
    document_date: str | None = Field(None, serialization_alias="documentDate")
    location: str | None = None

    scheduled_start_time: str | None = Field(None, serialization_alias="scheduledStartTime")
    scheduled_end_time: str | None = Field(None, serialization_alias="scheduledEndTime")
    actual_start_time: str | None = Field(None, serialization_alias="actualStartTime")
    actual_end_time: str | None = Field(None, serialization_alias="actualEndTime")

    prepared_by_user_id: str = Field(..., serialization_alias="preparedByUserId")

    intro_snippet: str | None = Field(None, serialization_alias="introSnippet")

    active_version_id: str | None = Field(None, serialization_alias="activeVersionId")
    latest_version_num: int = Field(..., serialization_alias="latestVersionNum")

    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")
    deleted_at: str | None = Field(None, serialization_alias="deletedAt")

    # Opcional (best-effort) si existen atributos "name" en los modelos relacionados
    client: EntityRefResponse | None = None
    project: EntityRefResponse | None = None
    record_type: EntityRefResponse | None = Field(None, serialization_alias="recordType")
    status: EntityRefResponse | None = None
    ai_profile: EntityRefResponse | None = Field(None, serialization_alias="aiProfile")
    prepared_by: UserRefResponse | None = Field(None, serialization_alias="preparedBy")

    model_config = {"populate_by_name": True}


class RecordListResponse(BaseModel):
    items: list[RecordResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
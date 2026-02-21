# schemas/record_version_participant.py

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class RecordVersionParticipantRole(str, Enum):
    required = "required"
    optional = "optional"
    observer = "observer"
    unknown = "unknown"


class RecordVersionParticipantCreateRequest(BaseModel):
    record_version_id: str
    role: RecordVersionParticipantRole = RecordVersionParticipantRole.unknown
    display_name: str
    organization: str | None = None
    title: str | None = None
    email: str | None = None

    model_config = {"populate_by_name": True}


class RecordVersionParticipantUpdateRequest(BaseModel):
    record_version_id: str | None = None
    role: RecordVersionParticipantRole | None = None
    display_name: str | None = None
    organization: str | None = None
    title: str | None = None
    email: str | None = None

    model_config = {"populate_by_name": True}


class RecordVersionParticipantFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    record_version_id: str | None = None
    role: RecordVersionParticipantRole | None = None
    display_name: str | None = None
    email: str | None = None

    model_config = {"populate_by_name": True}


class RecordVersionParticipantResponse(BaseModel):
    id: int

    record_version_id: str = Field(..., serialization_alias="recordVersionId")
    role: RecordVersionParticipantRole

    display_name: str = Field(..., serialization_alias="displayName")
    organization: str | None = None
    title: str | None = None
    email: str | None = None

    created_at: datetime | None = Field(None, serialization_alias="createdAt")
    updated_at: datetime | None = Field(None, serialization_alias="updatedAt")

    model_config = {"populate_by_name": True}


class RecordVersionParticipantListResponse(BaseModel):
    items: list[RecordVersionParticipantResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
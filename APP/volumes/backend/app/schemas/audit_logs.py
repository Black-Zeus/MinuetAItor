# schemas/audit_logs.py
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class AuditLogCreateRequest(BaseModel):
    actor_user_id: str = Field(..., min_length=36, max_length=36)
    action: str = Field(..., min_length=1, max_length=80)
    entity_type: str = Field(..., min_length=1, max_length=80)
    entity_id: str | None = Field(None, min_length=36, max_length=36)
    details_json: str | None = None
    event_at: datetime | None = None

    model_config = {"populate_by_name": True}


class AuditLogUpdateRequest(BaseModel):
    actor_user_id: str | None = Field(None, min_length=36, max_length=36)
    action: str | None = Field(None, min_length=1, max_length=80)
    entity_type: str | None = Field(None, min_length=1, max_length=80)
    entity_id: str | None = Field(None, min_length=36, max_length=36)
    details_json: str | None = None
    event_at: datetime | None = None

    model_config = {"populate_by_name": True}


class AuditLogFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    actor_user_id: str | None = Field(None, min_length=36, max_length=36)
    action: str | None = Field(None, min_length=1, max_length=80)
    entity_type: str | None = Field(None, min_length=1, max_length=80)
    entity_id: str | None = Field(None, min_length=36, max_length=36)

    event_from: datetime | None = Field(None, serialization_alias="eventFrom")
    event_to: datetime | None = Field(None, serialization_alias="eventTo")

    model_config = {"populate_by_name": True}


class AuditLogResponse(BaseModel):
    id: int
    event_at: str = Field(..., serialization_alias="eventAt")

    actor_user_id: str = Field(..., serialization_alias="actorUserId")
    actor_user: UserRefResponse | None = Field(None, serialization_alias="actorUser")

    action: str
    entity_type: str = Field(..., serialization_alias="entityType")
    entity_id: str | None = Field(None, serialization_alias="entityId")
    details_json: str | None = Field(None, serialization_alias="detailsJson")

    model_config = {"populate_by_name": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
# schemas/participants.py
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from schemas.clients import UserRefResponse


class ParticipantEmailResponse(BaseModel):
    id: int
    email: str
    is_primary: bool = Field(..., serialization_alias="isPrimary")
    is_active: bool = Field(..., serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class ParticipantFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(20, ge=1, le=100)

    search: str | None = None
    is_active: bool | None = Field(True, alias="isActive")

    model_config = {"populate_by_name": True}


class ParticipantEmailLookupRequest(BaseModel):
    names: list[str] = Field(default_factory=list, min_length=1, max_length=100)

    model_config = {"populate_by_name": True}


class ParticipantResolveRequest(BaseModel):
    participant_id: str | None = Field(None, alias="participantId")
    display_name: str = Field(..., min_length=1, max_length=220, alias="displayName")
    organization: str | None = Field(None, max_length=220)
    title: str | None = Field(None, max_length=160)
    email: str | None = Field(None, max_length=254)

    model_config = {"populate_by_name": True}


class ParticipantEmailLookupItem(BaseModel):
    display_name: str = Field(..., serialization_alias="displayName")
    normalized_name: str = Field(..., serialization_alias="normalizedName")
    participant_id: str | None = Field(None, serialization_alias="participantId")
    organization: str | None = None
    title: str | None = None
    matched_participants: int = Field(0, serialization_alias="matchedParticipants")
    emails: list[ParticipantEmailResponse] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class ParticipantResponse(BaseModel):
    id: str
    display_name: str = Field(..., serialization_alias="displayName")
    normalized_name: str = Field(..., serialization_alias="normalizedName")
    organization: str | None = None
    title: str | None = None
    notes: str | None = None
    is_active: bool = Field(..., serialization_alias="isActive")
    emails: list[ParticipantEmailResponse] = Field(default_factory=list)

    created_at: datetime | None = Field(None, serialization_alias="createdAt")
    updated_at: datetime | None = Field(None, serialization_alias="updatedAt")
    deleted_at: datetime | None = Field(None, serialization_alias="deletedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class ParticipantListResponse(BaseModel):
    items: list[ParticipantResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}


class ParticipantEmailLookupResponse(BaseModel):
    items: list[ParticipantEmailLookupItem] = Field(default_factory=list)

    model_config = {"populate_by_name": True}

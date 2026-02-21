# schemas/user_profiles.py
from __future__ import annotations

from datetime import date
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class UserProfileCreateRequest(BaseModel):
    user_id: str

    initials: str | None = None
    color: str | None = None
    position: str | None = None
    department: str | None = None
    notes: str | None = None
    last_activity: date | None = None

    model_config = {"populate_by_name": True}


class UserProfileUpdateRequest(BaseModel):
    initials: str | None = None
    color: str | None = None
    position: str | None = None
    department: str | None = None
    notes: str | None = None
    last_activity: date | None = None

    model_config = {"populate_by_name": True}


class UserProfileFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    user_id: str | None = None
    department: str | None = None
    position: str | None = None
    initials: str | None = None
    last_activity_from: date | None = Field(None, serialization_alias="lastActivityFrom")
    last_activity_to: date | None = Field(None, serialization_alias="lastActivityTo")

    model_config = {"populate_by_name": True}


class UserProfileResponse(BaseModel):
    user_id: str = Field(..., serialization_alias="userId")

    initials: str | None = None
    color: str | None = None
    position: str | None = None
    department: str | None = None
    notes: str | None = None
    last_activity: str | None = Field(None, serialization_alias="lastActivity")

    user: UserRefResponse | None = None

    model_config = {"populate_by_name": True}


class UserProfileListResponse(BaseModel):
    items: list[UserProfileResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
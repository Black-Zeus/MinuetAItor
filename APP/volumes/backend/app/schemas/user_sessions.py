# schemas/user_sessions.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class UserSessionsCreateRequest(BaseModel):
    user_id: str
    jti: str

    ip_v4: str | None = None
    ip_v6: str | None = None
    user_agent: str | None = None
    device: str | None = None

    country_code: str | None = None
    country_name: str | None = None
    city: str | None = None
    location: str | None = None

    logged_out_at: datetime | None = None

    model_config = {"populate_by_name": True}


class UserSessionsUpdateRequest(BaseModel):
    # partial update
    ip_v4: str | None = None
    ip_v6: str | None = None
    user_agent: str | None = None
    device: str | None = None

    country_code: str | None = None
    country_name: str | None = None
    city: str | None = None
    location: str | None = None

    logged_out_at: datetime | None = None

    model_config = {"populate_by_name": True}


class UserSessionsFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    user_id: str | None = None
    jti: str | None = None

    # True = solo cerradas; False = solo activas; None = todas
    is_logged_out: bool | None = Field(None, serialization_alias="isLoggedOut")

    country_code: str | None = None

    model_config = {"populate_by_name": True}


class UserSessionsResponse(BaseModel):
    id: str
    user_id: str = Field(..., serialization_alias="userId")
    jti: str

    ip_v4: str | None = Field(None, serialization_alias="ipV4")
    ip_v6: str | None = Field(None, serialization_alias="ipV6")
    user_agent: str | None = Field(None, serialization_alias="userAgent")
    device: str | None = None

    country_code: str | None = Field(None, serialization_alias="countryCode")
    country_name: str | None = Field(None, serialization_alias="countryName")
    city: str | None = None
    location: str | None = None

    logged_out_at: str | None = Field(None, serialization_alias="loggedOutAt")
    created_at: str = Field(..., serialization_alias="createdAt")

    # Relación (shape para frontend)
    user: UserRefResponse | None = None

    model_config = {"populate_by_name": True}


class UserSessionsListResponse(BaseModel):
    items: list[UserSessionsResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
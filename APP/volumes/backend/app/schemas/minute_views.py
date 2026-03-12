from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from schemas.minutes import MinuteRecordInfo, MinuteVersionItem


class MinuteViewAccessRequest(BaseModel):
    record_id: str = Field(..., alias="recordId")
    email: str

    model_config = {"populate_by_name": True}


class MinuteViewAccessRequestResponse(BaseModel):
    request_id: str = Field(..., serialization_alias="requestId")
    record_id: str = Field(..., serialization_alias="recordId")
    email: str
    expires_at: str = Field(..., serialization_alias="expiresAt")
    message: str

    model_config = {"populate_by_name": True}


class MinuteViewOtpVerifyRequest(BaseModel):
    record_id: str = Field(..., alias="recordId")
    email: str
    otp_code: str = Field(..., alias="otpCode", min_length=4, max_length=10)

    model_config = {"populate_by_name": True}


class MinuteViewVisitorInfo(BaseModel):
    email: str
    display_name: str | None = Field(None, serialization_alias="displayName")
    role: str | None = None

    model_config = {"populate_by_name": True}


class MinuteViewSessionResponse(BaseModel):
    access_token: str = Field(..., serialization_alias="accessToken")
    token_type: str = Field("visitor", serialization_alias="tokenType")
    expires_in: int = Field(..., serialization_alias="expiresIn")
    expires_at: str = Field(..., serialization_alias="expiresAt")
    record_id: str = Field(..., serialization_alias="recordId")
    visitor: MinuteViewVisitorInfo

    model_config = {"populate_by_name": True}


class MinuteViewObservationItem(BaseModel):
    id: int
    record_version_id: str = Field(..., serialization_alias="recordVersionId")
    author_email: str = Field(..., serialization_alias="authorEmail")
    author_name: str | None = Field(None, serialization_alias="authorName")
    body: str
    status: str
    resolution_type: str = Field("none", serialization_alias="resolutionType")
    editor_comment: str | None = Field(None, serialization_alias="editorComment")
    resolved_by: str | None = Field(None, serialization_alias="resolvedBy")
    resolution_note: str | None = Field(None, serialization_alias="resolutionNote")
    resolved_at: str | None = Field(None, serialization_alias="resolvedAt")
    applied_in_version_id: str | None = Field(None, serialization_alias="appliedInVersionId")
    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    is_current_version: bool = Field(False, serialization_alias="isCurrentVersion")

    model_config = {"populate_by_name": True}


class MinuteViewObservationGroup(BaseModel):
    record_version_id: str = Field(..., serialization_alias="recordVersionId")
    version_num: int = Field(..., serialization_alias="versionNum")
    version_label: str = Field(..., serialization_alias="versionLabel")
    is_active_version: bool = Field(False, serialization_alias="isActiveVersion")
    observations: list[MinuteViewObservationItem] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class MinuteViewDetailResponse(BaseModel):
    visitor: MinuteViewVisitorInfo
    record: MinuteRecordInfo
    content: dict[str, Any] | None = None
    content_type: Literal["ai_output", "draft", "snapshot"] | None = Field(None, serialization_alias="contentType")
    versions: list[MinuteVersionItem] = Field(default_factory=list)
    observation_groups: list[MinuteViewObservationGroup] = Field(default_factory=list, serialization_alias="observationGroups")
    current_version_id: str | None = Field(None, serialization_alias="currentVersionId")
    current_version_num: int | None = Field(None, serialization_alias="currentVersionNum")

    model_config = {"populate_by_name": True}


class MinuteViewObservationCreateRequest(BaseModel):
    body: str = Field(..., min_length=3, max_length=4000)

    model_config = {"populate_by_name": True}


class MinuteViewObservationCreateResponse(BaseModel):
    message: str
    observation: MinuteViewObservationItem

    model_config = {"populate_by_name": True}

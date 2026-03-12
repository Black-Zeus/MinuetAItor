from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class MinuteObservationItem(BaseModel):
    id: int
    record_id: str = Field(..., serialization_alias="recordId")
    record_version_id: str = Field(..., serialization_alias="recordVersionId")
    record_version_participant_id: int | None = Field(None, serialization_alias="recordVersionParticipantId")
    author_email: str = Field(..., serialization_alias="authorEmail")
    author_name: str | None = Field(None, serialization_alias="authorName")
    body: str
    status: str
    resolution_type: str = Field(..., serialization_alias="resolutionType")
    editor_comment: str | None = Field(None, serialization_alias="editorComment")
    resolved_by: str | None = Field(None, serialization_alias="resolvedBy")
    resolved_at: str | None = Field(None, serialization_alias="resolvedAt")
    applied_in_version_id: str | None = Field(None, serialization_alias="appliedInVersionId")
    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    version_num: int | None = Field(None, serialization_alias="versionNum")
    version_label: str | None = Field(None, serialization_alias="versionLabel")

    model_config = {"populate_by_name": True}


class MinuteObservationListResponse(BaseModel):
    record_id: str = Field(..., serialization_alias="recordId")
    items: list[MinuteObservationItem]

    model_config = {"populate_by_name": True}


class MinuteObservationResolveRequest(BaseModel):
    status: str
    editor_comment: str = Field(..., alias="editorComment", min_length=3, max_length=4000)
    resolution_type: str = Field("none", alias="resolutionType")

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_resolution(self):
        allowed_statuses = {"inserted", "approved", "rejected"}
        allowed_resolution_types = {"none", "direct_insert", "manual_update"}

        status = str(self.status or "").strip().lower()
        resolution_type = str(self.resolution_type or "").strip().lower()

        if status not in allowed_statuses:
            raise ValueError("status debe ser inserted, approved o rejected")
        if resolution_type not in allowed_resolution_types:
            raise ValueError("resolutionType inválido")
        if status == "inserted" and resolution_type != "direct_insert":
            raise ValueError("Las observaciones insertadas requieren resolutionType=direct_insert")
        if status == "approved" and resolution_type != "manual_update":
            raise ValueError("Las observaciones aprobadas requieren resolutionType=manual_update")
        if status == "rejected" and resolution_type != "none":
            raise ValueError("Las observaciones rechazadas requieren resolutionType=none")
        return self


class MinuteObservationResolveResponse(BaseModel):
    message: str
    item: MinuteObservationItem

    model_config = {"populate_by_name": True}

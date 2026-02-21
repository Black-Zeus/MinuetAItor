# schemas/record_drafts.py

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class RecordDraftCreateRequest(BaseModel):
    record_id: str = Field(..., min_length=36, max_length=36)

    model_config = {"populate_by_name": True}


class RecordDraftUpdateRequest(BaseModel):
    """
    Draft "touch": no hay campos de negocio en la tabla.
    Se mantiene por consistencia del contrato (PUT /{id}).
    """

    model_config = {"populate_by_name": True}


class RecordDraftFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    record_id: str | None = None
    created_by: str | None = None
    updated_by: str | None = None

    # Si es None => solo no eliminados (comportamiento estándar).
    # Si True => incluye eliminados.
    include_deleted: bool | None = None

    model_config = {"populate_by_name": True}


class RecordDraftResponse(BaseModel):
    record_id: str = Field(..., serialization_alias="recordId")

    created_at: datetime | None = Field(None, serialization_alias="createdAt")
    updated_at: datetime | None = Field(None, serialization_alias="updatedAt")

    deleted_at: datetime | None = Field(None, serialization_alias="deletedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class RecordDraftListResponse(BaseModel):
    items: list[RecordDraftResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
# schemas/record_version_tags.py

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class RecordVersionTagCreateRequest(BaseModel):
    record_version_id: str
    tag_id: str

    model_config = {"populate_by_name": True}


class RecordVersionTagUpdateRequest(BaseModel):
    """
    Tabla M-N: no es habitual "actualizar" PKs.
    Se usa como operación de 'touch' (actualiza added_at y added_by),
    sin campos en el body.
    """
    model_config = {"populate_by_name": True}


class RecordVersionTagFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    record_version_id: str | None = None
    tag_id: str | None = None
    added_by: str | None = None

    model_config = {"populate_by_name": True}


class RecordVersionTagResponse(BaseModel):
    record_version_id: str = Field(..., serialization_alias="recordVersionId")
    tag_id: str = Field(..., serialization_alias="tagId")
    added_at: datetime = Field(..., serialization_alias="addedAt")
    added_by: Optional[UserRefResponse] = Field(None, serialization_alias="addedBy")

    model_config = {"populate_by_name": True}


class RecordVersionTagListResponse(BaseModel):
    items: list[RecordVersionTagResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
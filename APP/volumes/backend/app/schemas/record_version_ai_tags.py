# schemas/record_version_ai_tags.py
from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class RecordVersionAiTagCreateRequest(BaseModel):
    record_version_id: str
    ai_tag_id: str
    detected_at: datetime | None = None

    model_config = {"populate_by_name": True}


class RecordVersionAiTagUpdateRequest(BaseModel):
    detected_at: datetime | None = None

    model_config = {"populate_by_name": True}


class RecordVersionAiTagFilterRequest(BaseModel):
    record_version_id: str | None = None
    ai_tag_id: str | None = None

    detected_from: datetime | None = None
    detected_to: datetime | None = None

    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    model_config = {"populate_by_name": True}


class RecordVersionAiTagResponse(BaseModel):
    record_version_id: str = Field(..., serialization_alias="recordVersionId")
    ai_tag_id: str = Field(..., serialization_alias="aiTagId")
    detected_at: str = Field(..., serialization_alias="detectedAt")

    model_config = {"populate_by_name": True}


class RecordVersionAiTagListResponse(BaseModel):
    items: List[RecordVersionAiTagResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
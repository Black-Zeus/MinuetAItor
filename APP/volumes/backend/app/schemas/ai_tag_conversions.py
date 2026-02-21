# schemas/ai_tag_conversions.py

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class AiTagConversionCreateRequest(BaseModel):
    ai_tag_id: str
    tag_id: str

    model_config = {"populate_by_name": True}


class AiTagConversionUpdateRequest(BaseModel):
    converted_by_id: Optional[str] = None

    model_config = {"populate_by_name": True}


class AiTagConversionFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    ai_tag_id: Optional[str] = None
    tag_id: Optional[str] = None
    converted_by_id: Optional[str] = None

    model_config = {"populate_by_name": True}


class AiTagConversionResponse(BaseModel):
    ai_tag_id: str = Field(..., serialization_alias="aiTagId")
    tag_id: str = Field(..., serialization_alias="tagId")
    converted_at: datetime = Field(..., serialization_alias="convertedAt")
    converted_by: UserRefResponse | None = Field(None, serialization_alias="convertedBy")

    model_config = {"populate_by_name": True}


class AiTagConversionListResponse(BaseModel):
    items: list[AiTagConversionResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
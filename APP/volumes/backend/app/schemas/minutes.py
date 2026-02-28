# schemas/minutes.py
"""
Schemas para el endpoint POST /v1/minutes/generate

El frontend (NewMinute.jsx) envía multipart/form-data con:
  - input_json  : string JSON (este schema lo valida)
  - files[]     : archivos adjuntos (transcripción, resumen, etc.)
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ── Sub-schemas del input JSON ────────────────────────────────────────────────

class MinuteMeetingInfo(BaseModel):
    scheduled_date:       str = Field(..., alias="scheduledDate")
    scheduled_start_time: str = Field(..., alias="scheduledStartTime")
    scheduled_end_time:   str = Field(..., alias="scheduledEndTime")
    actual_start_time:    Optional[str] = Field(None, alias="actualStartTime")
    actual_end_time:      Optional[str] = Field(None, alias="actualEndTime")
    location:             Optional[str] = None
    title:                Optional[str] = None

    model_config = {"populate_by_name": True}


class MinuteProjectInfo(BaseModel):
    client:   str
    project:  str
    category: Optional[str] = None

    model_config = {"populate_by_name": True}


class MinuteParticipants(BaseModel):
    attendees:       list[str]
    invited:         list[str] = Field(default_factory=list)
    copy_recipients: list[str] = Field(default_factory=list, alias="copyRecipients")

    model_config = {"populate_by_name": True}


class MinuteProfileInfo(BaseModel):
    profile_id:   str = Field(..., alias="profileId")
    profile_name: str = Field(..., alias="profileName")

    model_config = {"populate_by_name": True}


class MinuteGenerationOptions(BaseModel):
    language: str = "es"

    model_config = {"populate_by_name": True}


# ── Request principal (body del JSON dentro del multipart) ────────────────────

class MinuteGenerateRequest(BaseModel):
    """
    Corresponde al AI_input_Schema.json.
    El transactionId lo genera el backend — el frontend NO lo envía.
    """
    meeting_info:       MinuteMeetingInfo  = Field(..., alias="meetingInfo")
    project_info:       MinuteProjectInfo  = Field(..., alias="projectInfo")
    participants:       MinuteParticipants
    profile_info:       MinuteProfileInfo  = Field(..., alias="profileInfo")
    prepared_by:        str                = Field(..., alias="preparedBy")
    additional_notes:   Optional[str]      = Field(None, alias="additionalNotes")
    generation_options: MinuteGenerationOptions = Field(
        default_factory=MinuteGenerationOptions,
        alias="generationOptions",
    )

    model_config = {"populate_by_name": True}


# ── Responses ─────────────────────────────────────────────────────────────────

class MinuteGenerateResponse(BaseModel):
    """
    Respuesta al POST /generate — 202 Accepted.
    El frontend puede usar transaction_id para polling de estado.
    """
    transaction_id: str = Field(..., serialization_alias="transactionId")
    record_id:      str = Field(..., serialization_alias="recordId")
    status:         str  # "pending" | "processing"
    message:        str

    model_config = {"populate_by_name": True}


class MinuteStatusResponse(BaseModel):
    """Respuesta al GET /{transaction_id}/status"""
    transaction_id: str             = Field(..., serialization_alias="transactionId")
    record_id:      str             = Field(..., serialization_alias="recordId")
    status:         str             # pending | processing | completed | failed
    error_message:  Optional[str]   = Field(None, serialization_alias="errorMessage")
    created_at:     str             = Field(..., serialization_alias="createdAt")
    updated_at:     Optional[str]   = Field(None, serialization_alias="updatedAt")
    completed_at:   Optional[str]   = Field(None, serialization_alias="completedAt")

    model_config = {"populate_by_name": True}
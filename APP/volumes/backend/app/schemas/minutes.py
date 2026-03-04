# schemas/minutes.py
"""
Schemas para el módulo de minutas.

Endpoints:
  POST /v1/minutes/generate          → MinuteGenerateRequest / MinuteGenerateResponse
  GET  /v1/minutes/{record_id}       → MinuteDetailResponse
  PUT  /v1/minutes/{record_id}/save  → MinuteSaveRequest (body), 200 OK
  POST /v1/minutes/{record_id}/transition → MinuteTransitionRequest / MinuteTransitionResponse
"""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Sub-schemas del input generate ───────────────────────────────────────────

class MinuteMeetingInfo(BaseModel):
    scheduled_date:       str           = Field(..., alias="scheduledDate")
    scheduled_start_time: str           = Field(..., alias="scheduledStartTime")
    scheduled_end_time:   str           = Field(..., alias="scheduledEndTime")
    actual_start_time:    Optional[str] = Field(None, alias="actualStartTime")
    actual_end_time:      Optional[str] = Field(None, alias="actualEndTime")
    location:             Optional[str] = None
    title:                Optional[str] = None

    model_config = {"populate_by_name": True}


class MinuteProjectInfo(BaseModel):
    client:     str
    client_id:  Optional[str] = Field(None, alias="clientID")
    project:    str
    project_id: Optional[str] = Field(None, alias="projectID")
    category:   Optional[str] = None

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


class MinuteGenerateRequest(BaseModel):
    meeting_info:       MinuteMeetingInfo       = Field(..., alias="meetingInfo")
    project_info:       MinuteProjectInfo       = Field(..., alias="projectInfo")
    participants:       MinuteParticipants
    profile_info:       MinuteProfileInfo       = Field(..., alias="profileInfo")
    prepared_by:        str                     = Field(..., alias="preparedBy")
    additional_notes:   Optional[str]           = Field(None, alias="additionalNotes")
    generation_options: MinuteGenerationOptions = Field(
        default_factory=MinuteGenerationOptions,
        alias="generationOptions",
    )

    model_config = {"populate_by_name": True}


# ── Responses generate / status ───────────────────────────────────────────────

class MinuteGenerateResponse(BaseModel):
    transaction_id: str
    record_id:      str
    status:         str
    message:        str

    model_config = {
        "populate_by_name": True,
        "alias_generator": lambda s: "".join(
            w.capitalize() if i else w for i, w in enumerate(s.split("_"))
        ),
    }


class MinuteStatusResponse(BaseModel):
    transaction_id: str
    record_id:      str
    status:         str
    error_message:  Optional[str] = None
    created_at:     Optional[str] = None
    updated_at:     Optional[str] = None
    completed_at:   Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "alias_generator": lambda s: "".join(
            w.capitalize() if i else w for i, w in enumerate(s.split("_"))
        ),
    }


# ── PASO 3: GET /minutes/{record_id} ─────────────────────────────────────────

class MinuteRecordInfo(BaseModel):
    id:                 str
    status:             str
    title:              str
    client_id:          Optional[str] = Field(None, serialization_alias="clientId")
    client_name:        Optional[str] = Field(None, serialization_alias="clientName")
    project_id:         Optional[str] = Field(None, serialization_alias="projectId")
    project_name:       Optional[str] = Field(None, serialization_alias="projectName")
    active_version_id:  Optional[str] = Field(None, serialization_alias="activeVersionId")
    active_version_num: Optional[int] = Field(None, serialization_alias="activeVersionNum")
    document_date:      Optional[str] = Field(None, serialization_alias="documentDate")
    location:           Optional[str] = None
    prepared_by:        Optional[str] = Field(None, serialization_alias="preparedBy")
    created_at:         Optional[str] = Field(None, serialization_alias="createdAt")

    model_config = {"populate_by_name": True}


class MinuteDetailResponse(BaseModel):
    record:  MinuteRecordInfo
    content: Optional[dict[str, Any]] = None

    model_config = {"populate_by_name": True}


# ── PASO 4: PUT /minutes/{record_id}/save ────────────────────────────────────

class MinuteSaveRequest(BaseModel):
    content: dict[str, Any]

    model_config = {"populate_by_name": True}


# ── PASO 5: POST /minutes/{record_id}/transition ─────────────────────────────

class MinuteTransitionRequest(BaseModel):
    target_status:  str           = Field(..., alias="targetStatus")
    commit_message: Optional[str] = Field(None, alias="commitMessage")

    model_config = {"populate_by_name": True}


class MinuteTransitionResponse(BaseModel):
    record_id:     str            = Field(..., serialization_alias="recordId")
    status:        str
    version_num:   Optional[int]  = Field(None, serialization_alias="versionNum")
    version_id:    Optional[str]  = Field(None, serialization_alias="versionId")
    message:       str

    model_config = {"populate_by_name": True}

# ── PASO LIST: GET /minutes ───────────────────────────────────────────────────

class MinuteTagItem(BaseModel):
    label: str
    color: str

    model_config = {"populate_by_name": True}


class MinuteListItem(BaseModel):
    id:           str
    title:        str
    date:         Optional[str] = None
    time:         Optional[str] = None
    status:       str
    client:       Optional[str] = None
    project:      Optional[str] = None
    participants: list[str]     = Field(default_factory=list)
    summary:      Optional[str] = None
    tags:         list[MinuteTagItem] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class MinuteListResponse(BaseModel):
    minutes: list[MinuteListItem]
    total:   int
    skip:    int
    limit:   int

    model_config = {"populate_by_name": True}

# ── Agregar al final de schemas/minutes.py ────────────────────────────────────
from typing import Any

class MinuteRecordInfo(BaseModel):
    """Metadata del Record, embebida en MinuteDetailResponse."""
    id:                 str
    status:             str
    title:              Optional[str] = None
    client_id:          Optional[str] = None
    client_name:        Optional[str] = None
    project_id:         Optional[str] = None
    project_name:       Optional[str] = None
    active_version_id:  Optional[str] = None
    active_version_num: Optional[int] = None
    document_date:      Optional[str] = None
    location:           Optional[str] = None
    prepared_by:        Optional[str] = None
    created_at:         Optional[str] = None

    model_config = {"populate_by_name": True}


class MinuteDetailResponse(BaseModel):
    """Respuesta al GET /{record_id}."""
    record:  MinuteRecordInfo
    content: Optional[Any] = None   # JSON de la minuta o null si no disponible

    model_config = {"populate_by_name": True}


class MinuteSaveRequest(BaseModel):
    """Body del PUT /{record_id}/save."""
    content: dict


class MinuteTransitionRequest(BaseModel):
    """Body del POST /{record_id}/transition."""
    target_status:  str
    commit_message: Optional[str] = None


class MinuteTransitionResponse(BaseModel):
    """Respuesta al POST /{record_id}/transition."""
    record_id:   str
    status:      str
    version_num: Optional[int] = None
    version_id:  Optional[str] = None
    message:     str

    model_config = {"populate_by_name": True}


class MinuteListItem(BaseModel):
    id:           str
    title:        Optional[str]       = None
    date:         Optional[str]       = None
    time:         Optional[str]       = None
    status:       str
    client:       Optional[str]       = None
    project:      Optional[str]       = None
    participants: list[str]           = []
    summary:      Optional[str]       = None
    tags:         list[dict]          = []

    model_config = {"populate_by_name": True}


class MinuteListResponse(BaseModel):
    """Respuesta al GET /."""
    minutes: list[MinuteListItem]
    total:   int
    skip:    int
    limit:   int
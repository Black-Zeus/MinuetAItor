# schemas/minutes.py
"""
Schemas para el endpoint POST /v1/minutes/generate

El frontend (NewMinute.jsx) envía multipart/form-data con:
  - input_json  : string JSON (este schema lo valida)
  - files[]     : archivos adjuntos (transcripción, resumen, etc.)

Estructura esperada del input_json (camelCase, compatible con NewMinute.jsx):
{
  "meetingInfo": {
    "scheduledDate":      "2024-01-15",          -- requerido
    "scheduledStartTime": "10:00",               -- requerido
    "scheduledEndTime":   "11:30",               -- requerido
    "actualStartTime":    "10:05",               -- opcional
    "actualEndTime":      "11:35",               -- opcional
    "location":           "Microsoft Teams",     -- opcional
    "title":              "Reunión Q1 2024"      -- opcional
  },
  "projectInfo": {
    "client":   "Empresa XYZ S.A.",              -- requerido
    "project":  "Implementación CRM",            -- requerido
    "category": "Tecnología"                     -- opcional
  },
  "participants": {
    "attendees":       ["Juan Pérez", "María González"],  -- requerido, list[str]
    "invited":         ["Pedro Sánchez"],                 -- opcional
    "copyRecipients":  ["Ana Martínez"]                   -- opcional
  },
  "profileInfo": {
    "profileId":   "uuid-del-perfil",            -- requerido
    "profileName": "Perfil Ejecutivo"            -- requerido
  },
  "preparedBy":       "Laura Torres",            -- requerido, string
  "additionalNotes":  "Notas opcionales",        -- opcional
  "generationOptions": { "language": "es" }      -- opcional
}
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ── Sub-schemas del input JSON ────────────────────────────────────────────────

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
    client:   str
    project:  str
    category: Optional[str] = None

    model_config = {"populate_by_name": True}


class MinuteParticipants(BaseModel):
    """
    attendees y invited son listas de strings (nombres completos).
    El frontend convierte el textarea separado por coma a list[str].
    """
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
    Corresponde a la estructura enviada por NewMinute.jsx.
    El transactionId lo genera el backend — el frontend NO lo envía.

    preparedBy es string simple (nombre del usuario logueado).
    participants.attendees es list[str] (nombres).
    """
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


# ── Responses ─────────────────────────────────────────────────────────────────

class MinuteGenerateResponse(BaseModel):
    """
    Respuesta al POST /generate — 202 Accepted.
    El frontend usa transaction_id para polling y record_id para navegar al editor.
    Se serializa en camelCase para el frontend.
    """
    transaction_id: str
    record_id:      str
    status:         str
    message:        str

    model_config = {
        "populate_by_name": True,
        # Serializar como camelCase hacia el frontend
        "alias_generator": lambda s: "".join(
            w.capitalize() if i else w for i, w in enumerate(s.split("_"))
        ),
    }


class MinuteStatusResponse(BaseModel):
    """
    Respuesta al GET /{transaction_id}/status.
    """
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
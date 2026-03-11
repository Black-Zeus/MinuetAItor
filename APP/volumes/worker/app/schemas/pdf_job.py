"""
schemas/pdf_job.py

Contrato Pydantic del job encolado en queue:pdf.

Este archivo es compartido entre backend y worker.
El backend lo usa para construir y encolar el job.
El worker lo usa para deserializar y procesar el job.

Estructura del payload:
  context      → trazabilidad (record_id, version_id, trigger)
  options      → parámetros de render (watermark, template, destino MinIO)
  pdf_metadata → nodo adicional con datos del record (no viene del LLM)
  ia_response  → JSON canónico producido por OpenAI (de MinIO draft_current.json)
  callback     → instrucciones post-generación (canal Redis, campo DB)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Bloques internos de IAResponse — espejo de AI_output.json
# ---------------------------------------------------------------------------

class AttachmentInfo(BaseModel):
    fileName: str
    mimeType: str
    sha256: str


class MeetingSchedule(BaseModel):
    scheduledDate: str
    scheduledStartTime: str
    scheduledEndTime: str
    actualStartTime: Optional[str] = None
    actualEndTime: Optional[str] = None


class ProjectInfo(BaseModel):
    client: str
    project: str
    minuteTitle: str
    titleGeneratedByAI: bool = False


class ProfileInfo(BaseModel):
    profileId: str
    profileName: str


class InputInfo(BaseModel):
    attachments: List[AttachmentInfo] = []
    meetingSchedule: MeetingSchedule
    participants: Dict[str, Any]
    projectInfo: ProjectInfo
    profileInfo: Optional[ProfileInfo] = None
    additionalNotes: Optional[str] = None
    userProvidedTags: List[str] = []


class AIOutputMetadata(BaseModel):
    transactionId: str
    generatedAt: str
    generatedBy: str
    version: str


class ParticipantEntry(BaseModel):
    fullName: str
    initials: str


class ParticipantsBlock(BaseModel):
    invited: List[ParticipantEntry] = []
    attendees: List[ParticipantEntry] = []
    copyRecipients: List[ParticipantEntry] = []


class ScopeDetail(BaseModel):
    label: str
    description: str


class ScopeSectionContent(BaseModel):
    summary: str
    topicsList: Optional[List[str]] = None
    details: Optional[List[ScopeDetail]] = None


class ScopeSection(BaseModel):
    sectionId: str
    sectionTitle: str
    sectionType: str                    # "introduction" | "topic"
    content: ScopeSectionContent


class ScopeBlock(BaseModel):
    sections: List[ScopeSection] = []


class AgreementItem(BaseModel):
    agreementId: str
    subject: str
    body: str
    responsible: str
    dueDate: Optional[str] = None
    status: str


class AgreementsBlock(BaseModel):
    items: List[AgreementItem] = []


class RequirementItem(BaseModel):
    requirementId: str
    entity: str
    body: str
    responsible: str
    priority: str                       # "high" | "medium" | "low"
    status: str                         # "open" | "in_progress" | "closed"


class RequirementsBlock(BaseModel):
    items: List[RequirementItem] = []


class UpcomingMeetingItem(BaseModel):
    meetingId: str
    scheduledDate: str
    agenda: str
    attendees: List[str] = []


class UpcomingMeetingsBlock(BaseModel):
    items: List[UpcomingMeetingItem] = []


class AISuggestedTag(BaseModel):
    name: str
    description: str


class GeneralInfo(BaseModel):
    client: str
    subject: str
    meetingDate: str
    scheduledStartTime: str
    scheduledEndTime: str
    actualStartTime: Optional[str] = None
    actualEndTime: Optional[str] = None
    location: Optional[str] = None
    preparedBy: str


# ---------------------------------------------------------------------------
# IAResponse — espejo fiel de AI_output.json
# ---------------------------------------------------------------------------

class IAResponse(BaseModel):
    """
    JSON canónico producido por el LLM.
    Guardado en minuetaitor-draft/draft_current.json sin modificaciones.
    El template Jinja2 accede directamente a estos campos.
    """
    metadata: AIOutputMetadata
    inputInfo: InputInfo
    generalInfo: GeneralInfo
    participants: ParticipantsBlock
    scope: ScopeBlock
    agreements: AgreementsBlock
    requirements: RequirementsBlock
    upcomingMeetings: UpcomingMeetingsBlock
    aiSuggestedTags: List[AISuggestedTag] = []


# ---------------------------------------------------------------------------
# Bloques del job
# ---------------------------------------------------------------------------

class PdfJobContext(BaseModel):
    """Trazabilidad del job dentro del sistema."""
    record_id: str
    version_id: str
    record_status: str
    trigger: Literal["post_ai_processing", "manual_publish"]
    transaction_id: str


class PdfJobOptions(BaseModel):
    """Parámetros de renderizado y destino MinIO."""
    watermark: bool = True
    watermark_text: str = "BORRADOR"
    template: str = "minutes/default"
    language: str = "es"
    output_bucket: str
    output_key: str


class PdfJobMetadata(BaseModel):
    """
    Nodo adicional que no existe en AI_output.json.
    Inyectado por el backend desde la DB antes de encolar.
    El template Jinja2 lo usa para la cabecera del PDF.
    """
    client_name: str
    project_name: str
    project_category: Optional[str] = None
    minute_title: str
    minute_date: str
    minute_number: str
    version_number: int
    version_label: str
    elaborated_by: str
    elaborated_by_email: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class PdfJobCallback(BaseModel):
    """Instrucciones post-generación para el worker."""
    notify_redis_channel: str
    pdf_url_field: str                  # "draft_pdf_url" | "published_pdf_url"
    status_on_success: Optional[str] = None
    status_on_fail: str = "pdf_error"


# ---------------------------------------------------------------------------
# PdfJobPayload — contrato completo del job en queue:pdf
# ---------------------------------------------------------------------------

class PdfJobPayload(BaseModel):
    """
    Payload completo encolado en Redis queue:pdf.

    Serialización (backend):   payload.model_dump_json()
    Deserialización (worker):  PdfJobPayload.model_validate_json(raw)
    """
    job_id: str = Field(default_factory=lambda: f"pdf-{uuid.uuid4()}")
    job_type: Literal["generate_pdf"] = "generate_pdf"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    context: PdfJobContext
    options: PdfJobOptions
    pdf_metadata: PdfJobMetadata
    ia_response: IAResponse
    callback: PdfJobCallback

    model_config = {"populate_by_name": True}
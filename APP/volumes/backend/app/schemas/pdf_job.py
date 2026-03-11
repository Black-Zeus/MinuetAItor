"""
schemas/pdf_job.py

Contrato Pydantic para los jobs encolados en queue:pdf.

Estructura del job:
  - context    : identificadores del sistema (record_id, version_id, trigger)
  - options    : parámetros de renderizado (watermark, template, destino MinIO)
  - pdf_metadata : datos del record que el LLM no conoce (client, project, user...)
  - ia_response  : el JSON canónico producido por OpenAI, tal cual está en MinIO
  - callback   : qué hacer al terminar (canal Redis, campo DB a actualizar)

El nodo `pdf_metadata` es el nodo ADICIONAL que se inyecta en el builder.
El nodo `ia_response` replica la estructura de AI_output.json exactamente.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Helpers compartidos — espejo de AI_output.json
# ---------------------------------------------------------------------------

class AttachmentInfo(BaseModel):
    fileName: str
    mimeType: str
    sha256: str


class MeetingSchedule(BaseModel):
    scheduledDate: str                  # "2026-02-12"
    scheduledStartTime: str             # "09:00"
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
    participants: Dict[str, Any]        # attendees / copyRecipients
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
    status: str                         # "pending" | "in_progress" | "closed"


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
    """
    Bloque generalInfo del AI_output.json.
    Contiene datos de cabecera que el LLM replica desde el input.
    """
    client: str
    subject: str
    meetingDate: str                    # "12/02/2026"
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
    Representa el JSON canónico que produce el LLM y se guarda en
    minuetaitor-json y minuetaitor-draft/draft_current.json.

    No se modifica: se pasa íntegro al PDF worker para que Jinja2
    acceda directamente a los campos que necesite el template.
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
# PdfJobContext — identificadores del sistema
# ---------------------------------------------------------------------------

class PdfJobContext(BaseModel):
    """
    Trazabilidad del job dentro del sistema MinuetAItor.
    Todos los campos provienen de la DB, no del LLM.
    """
    record_id: str
    version_id: str
    record_status: str                  # status que disparó el job
    trigger: Literal[
        "post_ai_processing",           # TX2 terminó → watermark=True (BORRADOR)
        "manual_publish",               # Editor publicó → watermark=False (final)
    ]
    transaction_id: str                 # transactionId del AI_output (para correlación)


# ---------------------------------------------------------------------------
# PdfJobOptions — parámetros de renderizado
# ---------------------------------------------------------------------------

class PdfJobOptions(BaseModel):
    """
    Controla cómo se genera el PDF en Gotenberg/Jinja2.
    output_bucket y output_key determinan el destino en MinIO.
    """
    watermark: bool = True
    watermark_text: str = "BORRADOR"    # solo relevante si watermark=True
    template: str = "minutes/default"   # ruta relativa bajo templates/
    language: str = "es"
    output_bucket: str                  # "minuetaitor-draft" | "minuetaitor-published"
    output_key: str                     # path en MinIO, ej: "drafts/{record_id}/draft_current.pdf"


# ---------------------------------------------------------------------------
# PdfJobMetadata — EL NODO ADICIONAL
# Datos del record que el LLM no conoce y el PDF template necesita.
# Se construye en el backend leyendo la DB antes de encolar.
# ---------------------------------------------------------------------------

class PdfJobMetadata(BaseModel):
    """
    Nodo adicional que no existe en AI_output.json.
    Se inyecta al construir el job (pdf_job_builder.py) desde la DB.

    El template Jinja2 accede a este nodo para la cabecera del PDF:
    número de minuta, versión, datos del elaborador, etc.
    """
    # Datos del cliente/proyecto (desde JOIN records → projects → clients)
    client_name: str
    project_name: str
    project_category: Optional[str] = None

    # Datos de la minuta (desde table: records)
    minute_title: str
    minute_date: str                    # ISO "2026-03-10"
    minute_number: str                  # correlativo, ej: "MIN-2026-042"

    # Versión
    version_number: int                 # número entero de versión
    version_label: str                  # ej: "v1 - Borrador IA" | "v2 - Publicado"

    # Elaborador (desde JOIN records → users)
    elaborated_by: str                  # nombre completo
    elaborated_by_email: str

    # Timestamps de sistema
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# PdfJobCallback — qué hacer al terminar
# ---------------------------------------------------------------------------

class PdfJobCallback(BaseModel):
    """
    Instrucciones post-generación para el PDF worker.
    Indica qué canal Redis notificar y qué campo de DB actualizar.
    """
    notify_redis_channel: str           # "channel:record:{record_id}:pdf_ready"
    pdf_url_field: str                  # campo en DB: "draft_pdf_url" | "published_pdf_url"
    status_on_success: Optional[str] = None   # si se debe cambiar status en DB al terminar
    status_on_fail: str = "pdf_error"


# ---------------------------------------------------------------------------
# PdfJobPayload — contrato completo del job en queue:pdf
# ---------------------------------------------------------------------------

class PdfJobPayload(BaseModel):
    """
    Payload completo encolado en Redis queue:pdf.

    Serialización: model.model_dump_json()
    Deserialización: PdfJobPayload.model_validate_json(raw)

    Estructura:
      job_id        → UUID único del job
      job_type      → siempre "generate_pdf"
      created_at    → timestamp UTC de creación del job
      context       → trazabilidad (record_id, version_id, trigger)
      options       → parámetros Gotenberg (watermark, template, destino)
      pdf_metadata  → NODO ADICIONAL: datos de contexto desde DB
      ia_response   → JSON canónico del LLM (de MinIO)
      callback      → instrucciones post-generación
    """
    job_id: str = Field(default_factory=lambda: f"pdf-{uuid.uuid4()}")
    job_type: Literal["generate_pdf"] = "generate_pdf"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    context: PdfJobContext
    options: PdfJobOptions
    pdf_metadata: PdfJobMetadata        # ← el nodo adicional
    ia_response: IAResponse             # ← JSON canónico del LLM
    callback: PdfJobCallback

    model_config = {"populate_by_name": True}
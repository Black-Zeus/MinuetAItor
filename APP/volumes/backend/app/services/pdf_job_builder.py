"""
services/pdf_job_builder.py

Construye el job para queue:pdf con la estructura exacta que
consume handlers/minute_pdf.py en el pdf-worker.

Mapeo completo basado en el JSON real de OpenAI (schema_output_v1.json):
  - Todas las claves camelCase del LLM se normalizan a snake_case
  - Todos los campos usados por los templates Jinja2 están cubiertos

Triggers soportados:
  "ready-for-edit" → post TX2, watermark=True,  destino minuetaitor-draft
  "completed"      → publicación manual, watermark=False, destino minuetaitor-published
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuración de triggers
# ---------------------------------------------------------------------------

PDF_TRIGGER_CONFIG: Dict[str, Dict[str, Any]] = {
    "ready-for-edit": {
        "trigger":           "post_ai_processing",
        "template":          "opc_01",
        "watermark":         True,
        "paper":             "A4",
        "minio_bucket":      "minuetaitor-draft",
        "output_key_tpl":    "drafts/{record_id}/draft_current.pdf",
        "pdf_url_field":     "draft_pdf_url",
        "status_on_success": None,
    },
    "completed": {
        "trigger":           "manual_publish",
        "template":          "opc_01",
        "watermark":         False,
        "paper":             "A4",
        "minio_bucket":      "minuetaitor-published",
        "output_key_tpl":    "published/{record_id}/final.pdf",
        "pdf_url_field":     "published_pdf_url",
        "status_on_success": None,
    },
}


def get_trigger_config(record_status: str) -> Dict[str, Any] | None:
    return PDF_TRIGGER_CONFIG.get(record_status)


# ---------------------------------------------------------------------------
# Builder principal
# ---------------------------------------------------------------------------

def build_pdf_job(record: Any, trigger_config: Dict[str, Any]) -> Dict[str, Any]:
    _assert_relations(record)

    record_id  = str(record.id)
    version_id = str(record.active_version_id)

    ia_response  = _load_ia_response(record_id)
    pdf_metadata = _build_pdf_metadata(record, trigger_config)
    output_key   = trigger_config["output_key_tpl"].format(record_id=record_id)

    # Tags: el template los usa como variable "ai_tags" (no "ai_suggested_tags")
    ai_tags = ia_response.get("aiSuggestedTags", [])

    payload = {
        "record_id":        record_id,
        "version_id":       version_id,
        "template":         trigger_config["template"],
        "minio_output_key": output_key,
        "minio_bucket":     trigger_config["minio_bucket"],
        "version_label":    pdf_metadata["version_label"],
        "options": {
            "watermark": trigger_config["watermark"],
            "paper":     trigger_config["paper"],
        },
        "data": {
            "pdf_metadata":      pdf_metadata,
            "general_info":      _map_general_info(ia_response.get("generalInfo", {})),
            "participants":      _map_participants(ia_response.get("participants", {})),
            "scope":             _map_scope(ia_response.get("scope", {})),
            "agreements":        _map_agreements(ia_response.get("agreements", {})),
            "requirements":      _map_requirements(ia_response.get("requirements", {})),
            "upcoming_meetings": _map_upcoming_meetings(ia_response.get("upcomingMeetings", {})),
            "ai_tags":           ai_tags,           # nombre que usan los templates
            "input_info":        ia_response.get("inputInfo", {}),
            "metadata":          ia_response.get("metadata", {}),
        },
        "callback": {
            "notify_redis_channel": f"channel:record:{record_id}:pdf_ready",
            "pdf_url_field":        trigger_config["pdf_url_field"],
            "status_on_success":    trigger_config.get("status_on_success"),
            "status_on_fail":       "pdf_error",
        },
    }

    envelope = {
        "job_id":  f"pdf-{uuid.uuid4()}",
        "type":    "minute_pdf",
        "queue":   "queue:pdf",
        "attempt": 1,
        "payload": payload,
    }

    return envelope


# ---------------------------------------------------------------------------
# Mapeos camelCase → snake_case
# Basados en el JSON real que retorna el LLM (schema_output_v1.json)
# ---------------------------------------------------------------------------

def _map_general_info(gi: Dict[str, Any]) -> Dict[str, Any]:
    """
    JSON LLM:                   Template Jinja2:
      client                  → client
      subject                 → subject
      meetingDate             → meeting_date
      scheduledStartTime      → scheduled_start_time
      actualStartTime         → actual_start_time
      scheduledEndTime        → scheduled_end_time
      actualEndTime           → actual_end_time
      location                → location
      preparedBy              → prepared_by
      (no existe en LLM)      → project  (fallback "")
    """
    return {
        "client":               gi.get("client", ""),
        "project":              gi.get("project", ""),
        "subject":              gi.get("subject", ""),
        "meeting_date":         gi.get("meetingDate", ""),
        "prepared_by":          gi.get("preparedBy", ""),
        "location":             gi.get("location", ""),
        "scheduled_start_time": gi.get("scheduledStartTime", ""),
        "scheduled_end_time":   gi.get("scheduledEndTime", ""),
        "actual_start_time":    gi.get("actualStartTime", ""),
        "actual_end_time":      gi.get("actualEndTime", ""),
    }


def _map_participants(p: Dict[str, Any]) -> Dict[str, Any]:
    """
    JSON LLM:                   Template Jinja2:
      invited[]               → invited[]
      attendees[].fullName    → attendees[].full_name
      attendees[].initials    → attendees[].initials
      copyRecipients[]        → copy_recipients[]
    """
    def normalize_person(person: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "full_name": person.get("fullName", person.get("full_name", "")),
            "initials":  person.get("initials", ""),
            "role":      person.get("role", ""),
        }

    return {
        "invited":          [normalize_person(x) for x in p.get("invited", [])],
        "attendees":        [normalize_person(x) for x in p.get("attendees", [])],
        "copy_recipients":  [normalize_person(x) for x in p.get("copyRecipients",
                                                                  p.get("copy_recipients", []))],
    }


def _map_scope(s: Dict[str, Any]) -> Dict[str, Any]:
    """
    JSON LLM:                   Template Jinja2:
      sections[].sectionId    → sections[].section_id
      sections[].sectionTitle → sections[].section_title
      sections[].sectionType  → sections[].section_type
      content.topicsList[]    → content.topics_list[]
      content.details[]       → content.details[]  (label/description ya ok)
    """
    def normalize_section(sec: Dict[str, Any]) -> Dict[str, Any]:
        content_raw = sec.get("content", {})
        content = {
            "summary":     content_raw.get("summary", ""),
            "topics_list": content_raw.get("topicsList",
                                           content_raw.get("topics_list", [])),
            "details":     content_raw.get("details", []),
        }
        return {
            "section_id":    sec.get("sectionId",    sec.get("section_id", "")),
            "section_title": sec.get("sectionTitle", sec.get("section_title", "")),
            "section_type":  sec.get("sectionType",  sec.get("section_type", "")),
            "content":       content,
        }

    return {
        "sections": [normalize_section(s) for s in s.get("sections", [])],
    }


def _map_agreements(a: Dict[str, Any]) -> Dict[str, Any]:
    """
    JSON LLM:                   Template Jinja2:
      items[].agreementId     → (ignorado)
      items[].subject         → subject ✓
      items[].body            → body ✓
      items[].responsible     → responsible ✓
      items[].dueDate         → due_date
      items[].status          → status ✓
    """
    def normalize_item(item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "subject":     item.get("subject", ""),
            "body":        item.get("body", ""),
            "responsible": item.get("responsible", ""),
            "due_date":    item.get("dueDate", item.get("due_date", "")),
            "status":      item.get("status", "pending"),
        }

    return {
        "items": [normalize_item(x) for x in a.get("items", [])],
    }


def _map_requirements(r: Dict[str, Any]) -> Dict[str, Any]:
    """
    JSON LLM:                   Template Jinja2:
      items[].requirementId   → (ignorado)
      items[].entity          → entity ✓
      items[].body            → body ✓
      items[].responsible     → responsible ✓
      items[].priority        → priority ✓
      items[].status          → status ✓
    """
    def normalize_item(item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "entity":      item.get("entity", ""),
            "body":        item.get("body", ""),
            "responsible": item.get("responsible", ""),
            "priority":    item.get("priority", "medium"),
            "status":      item.get("status", "open"),
        }

    return {
        "items": [normalize_item(x) for x in r.get("items", [])],
    }


def _map_upcoming_meetings(u: Dict[str, Any]) -> Dict[str, Any]:
    """
    JSON LLM:                   Template Jinja2:
      items[].meetingId       → (ignorado)
      items[].scheduledDate   → scheduled_date
      items[].agenda          → agenda ✓
      items[].attendees[]     → attendees ✓
    """
    def normalize_item(item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "scheduled_date": item.get("scheduledDate",
                                       item.get("scheduled_date", "")),
            "agenda":         item.get("agenda", ""),
            "attendees":      item.get("attendees", []),
        }

    return {
        "items": [normalize_item(x) for x in u.get("items", [])],
    }


# ---------------------------------------------------------------------------
# Helpers ORM
# ---------------------------------------------------------------------------

def _build_pdf_metadata(record: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    version_number = _get_version_number(record)
    version_label  = _build_version_label(version_number, config["trigger"])

    return {
        "client_name":         record.project.client.name,
        "project_name":        record.project.name,
        "project_category":    getattr(record.project, "code", None),
        "minute_title":        record.title,
        "minute_date":         _format_date(record.document_date),
        "minute_number":       getattr(record, "record_number", None),
        "version_number":      version_number,
        "version_label":       version_label,
        "elaborated_by":       record.created_by_user.full_name,
        "elaborated_by_email": record.created_by_user.email,
    }


def _load_ia_response(record_id: str) -> Dict[str, Any]:
    from db.minio_client import get_minio_client

    minio  = get_minio_client()
    bucket = "minuetaitor-json"
    key    = f"{record_id}/schema_output_v1.json"

    logger.debug("pdf_job_builder: leyendo %s/%s", bucket, key)

    try:
        response = minio.get_object(bucket, key)
        raw      = response.read()
        return json.loads(raw)
    except Exception as exc:
        raise RuntimeError(
            f"pdf_job_builder: no se pudo leer schema_output_v1.json "
            f"para record_id={record_id}: {exc}"
        ) from exc


def _assert_relations(record: Any) -> None:
    errors = []
    if not getattr(record, "project", None):
        errors.append("record.project no cargado")
    elif not getattr(record.project, "client", None):
        errors.append("record.project.client no cargado")
    if not getattr(record, "created_by_user", None):
        errors.append("record.created_by_user no cargado")
    if not getattr(record, "active_version_id", None):
        errors.append("record.active_version_id no disponible")
    if errors:
        raise ValueError(
            f"pdf_job_builder: relaciones faltantes para record_id={record.id}: "
            + "; ".join(errors)
        )


def _get_version_number(record: Any) -> int:
    return getattr(record, "latest_version_num", 1) or 1


def _build_version_label(version_number: int, trigger: str) -> str:
    suffix = "Borrador IA" if trigger == "post_ai_processing" else "Publicado"
    return f"v{version_number} - {suffix}"


def _format_date(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return value.isoformat()[:10]
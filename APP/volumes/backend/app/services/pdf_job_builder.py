"""
services/pdf_job_builder.py

Construye el job para queue:pdf con la estructura exacta que
consume handlers/minute_pdf.py en el pdf-worker.

Mapeo completo basado en el JSON real de OpenAI (schema_output_v1.json):
  - Todas las claves camelCase del LLM se normalizan a snake_case
  - Todos los campos usados por los templates Jinja2 están cubiertos

Triggers soportados:
  "ready-for-edit" → post TX2, watermark=True,  destino minuetaitor-draft
  "pending"        → autosave del editor, watermark=True, destino minuetaitor-draft
                     usa build_pdf_job_from_draft() con datos en formato editor
  "completed"      → publicación manual, watermark=False, destino minuetaitor-published
"""

from __future__ import annotations

import base64
import json
import logging
import uuid
from typing import Any, Dict, List

from sqlalchemy.orm import object_session

from core.exceptions import BadRequestException
from services.clients_service import read_client_logo_content
from services.organization_settings_service import (
    get_organization_settings,
    read_organization_logo_content,
)
from services.pdf_template_resolver import DEFAULT_PDF_TEMPLATE, resolve_pdf_template_for_record

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuración de triggers
# ---------------------------------------------------------------------------

PDF_TRIGGER_CONFIG: Dict[str, Dict[str, Any]] = {
    "ready-for-edit": {
        "trigger":           "post_ai_processing",
        "template":          DEFAULT_PDF_TEMPLATE,
        "watermark":         True,
        "paper":             "A4",
        "minio_bucket":      "minuetaitor-draft",
        "output_key_tpl":    "drafts/{record_id}/draft_current.pdf",
        "pdf_url_field":     "draft_pdf_url",
        "status_on_success": None,
    },
    # Usado por build_pdf_job_on_save() al guardar el editor (estado pending).
    # El template se sobreescribe con el valor de draft_content.pdfFormat.template.
    "pending": {
        "trigger":           "autosave",
        "template":          DEFAULT_PDF_TEMPLATE,   # fallback; se sobreescribe desde el draft
        "watermark":         True,
        "paper":             "A4",
        "minio_bucket":      "minuetaitor-draft",
        "output_key_tpl":    "drafts/{record_id}/draft_current.pdf",
        "pdf_url_field":     "draft_pdf_url",
        "status_on_success": None,
    },
    "completed": {
        "trigger":           "manual_publish",
        "template":          DEFAULT_PDF_TEMPLATE,
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
    resolved_template = resolve_pdf_template_for_record(record)

    # Tags: el template los usa como variable "ai_tags" (no "ai_suggested_tags")
    ai_tags = ia_response.get("aiSuggestedTags", [])

    payload = {
        "record_id":        record_id,
        "version_id":       version_id,
        "template":         resolved_template,
        "minio_output_key": output_key,
        "minio_bucket":     trigger_config["minio_bucket"],
        "version_label":    pdf_metadata["version_label"],
        "options": {
            "watermark": trigger_config["watermark"],
            "paper":     trigger_config["paper"],
        },
        "data": {
            "pdf_metadata":      pdf_metadata,
            "pdf_format":        _map_pdf_format_from_ia_response(ia_response),
            "cover_context":     _build_cover_context(record, ia_response),
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
        "notification": _build_pdf_notification_payload(
            record=record,
            trigger_config=trigger_config,
            record_id=record_id,
            version_id=version_id,
            output_key=output_key,
        ),
        "post_publish_email": _build_post_publish_email_payload(record, trigger_config),
    }

    envelope = {
        "job_id":  f"pdf-{uuid.uuid4()}",
        "type":    "minute_pdf",
        "queue":   "queue:pdf",
        "attempt": 1,
        "payload": payload,
    }

    return envelope


def build_pdf_job_from_active_editor_content(record: Any, trigger_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Construye un PDF de publicación desde el contenido editorial vigente.

    En preview el usuario puede insertar observaciones y guardar cambios contra
    draft_current.json / schema_output_vN. El PDF final debe tomar esa fuente,
    no el snapshot IA inicial.
    """
    content = _load_active_editor_content(record)
    if _is_editor_content(content):
        return build_pdf_job_from_draft(record=record, draft_content=content, trigger_config=trigger_config)

    logger.warning(
        "pdf_job_builder: contenido activo no parece formato editor; usando builder legacy | record_id=%s",
        getattr(record, "id", "unknown"),
    )
    return build_pdf_job(record=record, trigger_config=trigger_config)


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
    def normalize_person(person: Any) -> Dict[str, Any]:
        if isinstance(person, str):
            return {
                "full_name": person.strip(),
                "initials": "",
                "role": "",
            }
        if not isinstance(person, dict):
            return {
                "full_name": "",
                "initials": "",
                "role": "",
            }
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
    last_error: Exception | None = None
    for key in (f"{record_id}/schema_output_v0.json", f"{record_id}/schema_output_v1.json"):
        logger.debug("pdf_job_builder: leyendo %s/%s", bucket, key)
        try:
            response = minio.get_object(bucket, key)
            raw = response.read()
            return json.loads(raw)
        except Exception as exc:
            last_error = exc

    raise RuntimeError(
        f"pdf_job_builder: no se pudo leer schema_output_v0.json ni schema_output_v1.json "
        f"para record_id={record_id}: {last_error}"
    )


def _load_json_object(bucket: str, key: str) -> Dict[str, Any]:
    from db.minio_client import get_minio_client

    minio = get_minio_client()
    response = minio.get_object(bucket, key)
    try:
        raw = response.read()
        return json.loads(raw)
    finally:
        try:
            response.close()
            response.release_conn()
        except Exception:
            pass


def _active_version_number(record: Any) -> int:
    session = object_session(record)
    if session is not None and getattr(record, "active_version_id", None):
        try:
            from models.record_versions import RecordVersion

            version = (
                session.query(RecordVersion)
                .filter(RecordVersion.id == str(record.active_version_id))
                .first()
            )
            if version is not None:
                return int(version.version_num or 0)
        except Exception as exc:
            logger.debug("pdf_job_builder: no se pudo leer active_version | record_id=%s err=%s", record.id, exc)
    return int(getattr(record, "latest_version_num", 0) or 0)


def _load_active_editor_content(record: Any) -> Dict[str, Any]:
    record_id = str(record.id)
    version_number = _active_version_number(record)
    candidate_objects: list[tuple[str, str]] = []
    if version_number > 0:
        candidate_objects.append(("minuetaitor-json", f"{record_id}/schema_output_v{version_number}.json"))
    candidate_objects.extend(
        [
            ("minuetaitor-draft", f"{record_id}/draft_current.json"),
            ("minuetaitor-json", f"{record_id}/schema_output_v1.json"),
            ("minuetaitor-json", f"{record_id}/schema_output_v0.json"),
        ]
    )

    last_error: Exception | None = None
    seen: set[tuple[str, str]] = set()
    for bucket, key in candidate_objects:
        if (bucket, key) in seen:
            continue
        seen.add((bucket, key))
        logger.debug("pdf_job_builder: leyendo contenido activo %s/%s", bucket, key)
        try:
            return _load_json_object(bucket, key)
        except Exception as exc:
            last_error = exc

    raise RuntimeError(
        f"pdf_job_builder: no se pudo leer contenido editorial activo "
        f"para record_id={record_id}: {last_error}"
    )


def _is_editor_content(content: Dict[str, Any] | None) -> bool:
    if not isinstance(content, dict):
        return False
    return any(
        key in content
        for key in (
            "meetingInfo",
            "scopeSections",
            "agreements",
            "requirements",
            "participants",
            "nextMeetings",
            "pdfFormat",
        )
    )


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
    suffix_map = {
        "post_ai_processing": "Borrador IA",
        "autosave":           "Borrador",
        "manual_publish":     "Publicado",
    }
    suffix = suffix_map.get(trigger, "Borrador")
    return f"v{version_number} - {suffix}"


def _format_date(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return value.isoformat()[:10]


def _build_cover_context(record: Any, ia_response: Dict[str, Any]) -> Dict[str, Any]:
    db = object_session(record)

    organization_name = "MinuetAItor"
    organization_logo_data_uri = None
    client_logo_data_uri = None

    if db is not None:
        try:
            org = get_organization_settings(db)
            organization_name = org.get("name") or organization_name
        except Exception:
            pass

        try:
            logo_bytes, logo_content_type = read_organization_logo_content(db)
            organization_logo_data_uri = _to_data_uri(logo_bytes, logo_content_type)
        except (BadRequestException, Exception):
            organization_logo_data_uri = None

        try:
            client_logo_bytes, client_logo_content_type = read_client_logo_content(db, str(record.client_id))
            client_logo_data_uri = _to_data_uri(client_logo_bytes, client_logo_content_type)
        except Exception:
            client_logo_data_uri = None

    return {
        "organization_name": organization_name,
        "organization_logo_data_uri": organization_logo_data_uri,
        "client_logo_data_uri": client_logo_data_uri,
        "brief_summary": _resolve_brief_summary(record, ia_response),
    }


def _to_data_uri(content: bytes | None, content_type: str | None) -> str | None:
    if not content:
        return None
    mime_type = (content_type or "application/octet-stream").strip() or "application/octet-stream"
    encoded = base64.b64encode(content).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _resolve_brief_summary(record: Any, ia_response: Dict[str, Any]) -> str:
    intro_snippet = str(getattr(record, "intro_snippet", "") or "").strip()
    if intro_snippet:
        return intro_snippet

    sections = (((ia_response or {}).get("scope") or {}).get("sections") or [])
    for section in sections:
        if not isinstance(section, dict):
            continue
        content = section.get("content") or {}
        summary = str(content.get("summary", "") or "").strip()
        if summary:
            return summary

    subject = (((ia_response or {}).get("generalInfo") or {}).get("subject") or "")
    return str(subject or "").strip()


def _build_cover_context_from_draft(record: Any, draft_content: Dict[str, Any]) -> Dict[str, Any]:
    pseudo_ia_response = {
        "generalInfo": {
            "subject": ((draft_content or {}).get("meetingInfo") or {}).get("subject", ""),
        },
        "scope": {
            "sections": [
                {"content": {"summary": section.get("summary", "")}}
                for section in ((draft_content or {}).get("scopeSections") or [])
                if isinstance(section, dict)
            ],
        },
    }
    return _build_cover_context(record, pseudo_ia_response)


# ---------------------------------------------------------------------------
# Builder desde draft (formato editor)
# Usado cuando el contenido ya está en formato del store (draft_current.json).
# ---------------------------------------------------------------------------

def build_pdf_job_on_save(record: Any, draft_content: Dict[str, Any]) -> Dict[str, Any]:
    """
    Construye un job PDF a partir del draft guardado por el editor.
    Conveniencia para llamar desde save_minute_draft().
    El template se lee de draft_content.pdfFormat.template (fallback: opc_01).
    """
    config = PDF_TRIGGER_CONFIG["pending"]
    return build_pdf_job_from_draft(record=record, draft_content=draft_content, trigger_config=config)


def build_pdf_job_from_draft(
    record:         Any,
    draft_content:  Dict[str, Any],
    trigger_config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Construye el envelope PDF usando draft_current.json (formato editor).

    Diferencia con build_pdf_job():
      - Los datos vienen de draft_content (formato editor, snake/camel mixto),
        no de schema_output_v1.json (formato IA, camelCase puro).
      - El template se lee de draft_content.pdfFormat.template si está definido.
    """
    _assert_relations(record)

    record_id  = str(record.id)
    version_id = str(record.active_version_id)

    # Template: preferir la selección del usuario en el editor
    pdf_format = draft_content.get("pdfFormat", {})
    template   = pdf_format.get("template") or resolve_pdf_template_for_record(record)

    pdf_metadata = _build_pdf_metadata(record, trigger_config)
    output_key   = trigger_config["output_key_tpl"].format(record_id=record_id)

    payload = {
        "record_id":        record_id,
        "version_id":       version_id,
        "template":         template,
        "minio_output_key": output_key,
        "minio_bucket":     trigger_config["minio_bucket"],
        "version_label":    pdf_metadata["version_label"],
        "options": {
            "watermark": trigger_config["watermark"],
            "paper":     trigger_config["paper"],
        },
        "data": {
            "pdf_metadata":      pdf_metadata,
            "pdf_format":        _map_pdf_format_from_draft(draft_content),
            "cover_context":     _build_cover_context_from_draft(record, draft_content),
            "general_info":      _map_general_info_from_draft(draft_content),
            "participants":      _map_participants_from_draft(draft_content),
            "scope":             _map_scope_from_draft(draft_content),
            "agreements":        _map_agreements_from_draft(draft_content),
            "requirements":      _map_requirements_from_draft(draft_content),
            "upcoming_meetings": _map_upcoming_meetings_from_draft(draft_content),
            "ai_tags":           [
                {"name": t.get("name", ""), "description": t.get("description", "")}
                for t in draft_content.get("aiTags", [])
            ],
            "input_info": {},
            "metadata":   {},
        },
        "callback": {
            "notify_redis_channel": f"channel:record:{record_id}:pdf_ready",
            "pdf_url_field":        trigger_config["pdf_url_field"],
            "status_on_success":    trigger_config.get("status_on_success"),
            "status_on_fail":       "pdf_error",
        },
        "notification": _build_pdf_notification_payload(
            record=record,
            trigger_config=trigger_config,
            record_id=record_id,
            version_id=version_id,
            output_key=output_key,
        ),
        "post_publish_email": _build_post_publish_email_payload(record, trigger_config),
    }

    return {
        "job_id":  f"pdf-{uuid.uuid4()}",
        "type":    "minute_pdf",
        "queue":   "queue:pdf",
        "attempt": 1,
        "payload": payload,
    }


def _map_pdf_format_from_ia_response(ia_response: Dict[str, Any]) -> Dict[str, Any]:
    raw = ia_response.get("pdfFormat") if isinstance(ia_response, dict) else None
    return _map_pdf_format_common(raw, timeline_entries=None)


def _map_pdf_format_from_draft(draft_content: Dict[str, Any]) -> Dict[str, Any]:
    raw = draft_content.get("pdfFormat") if isinstance(draft_content, dict) else None
    timeline_entries = draft_content.get("timeline") if isinstance(draft_content, dict) else None
    mapped = _map_pdf_format_common(raw, timeline_entries=timeline_entries)
    meeting_info = draft_content.get("meetingInfo") if isinstance(draft_content, dict) else {}
    if isinstance(meeting_info, dict):
        if not str(mapped.get("cover_page", {}).get("project_name", "") or "").strip():
            mapped["cover_page"]["project_name"] = str(meeting_info.get("project", "") or "").strip()
        if not str(mapped.get("cover_page", {}).get("minute_title", "") or "").strip():
            mapped["cover_page"]["minute_title"] = str(meeting_info.get("subject", "") or "").strip()
        if not str(mapped.get("cover_page", {}).get("prepared_by", "") or "").strip():
            mapped["cover_page"]["prepared_by"] = str(meeting_info.get("preparedBy", "") or "").strip()
    return mapped


def _map_pdf_format_common(
    raw_pdf_format: Dict[str, Any] | None,
    timeline_entries: Any = None,
) -> Dict[str, Any]:
    raw = raw_pdf_format if isinstance(raw_pdf_format, dict) else {}

    cover = raw.get("coverPage") if isinstance(raw.get("coverPage"), dict) else {}
    summary = raw.get("summarySheet") if isinstance(raw.get("summarySheet"), dict) else {}
    version = raw.get("versionControl") if isinstance(raw.get("versionControl"), dict) else {}
    signature = raw.get("signaturePage") if isinstance(raw.get("signaturePage"), dict) else {}
    footer = raw.get("footerBar") if isinstance(raw.get("footerBar"), dict) else {}

    entries: list[Dict[str, Any]] = []
    if isinstance(timeline_entries, list):
      for entry in timeline_entries:
        if not isinstance(entry, dict):
            continue
        entries.append(
            {
                "version": entry.get("version", ""),
                "date": str(entry.get("publishedAt", "")).strip()[:10],
                "author": entry.get("publishedBy", ""),
                "description": entry.get("observation") or entry.get("changesSummary") or "",
                "status": "Emitida",
            }
        )

    signatories: list[Dict[str, Any]] = []
    raw_signatories = signature.get("signatories")
    if isinstance(raw_signatories, list):
        for sig in raw_signatories:
            if not isinstance(sig, dict):
                continue
            signatories.append(
                {
                    "full_name": sig.get("fullName", ""),
                    "role": " · ".join(
                        [part for part in [sig.get("role", ""), sig.get("area", "")] if str(part).strip()]
                    ),
                }
            )

    return {
        "template": raw.get("template"),
        "cover_page": {
            "enabled": bool(cover.get("enabled", False)),
            "project_name": cover.get("projectName", ""),
            "minute_title": cover.get("minuteTitle", ""),
            "prepared_by": cover.get("preparedBy", ""),
            "subtitle": cover.get("footerNote", ""),
        },
        "summary_sheet": {
            "enabled": bool(summary.get("enabled", False)),
        },
        "version_control": {
            "enabled": bool(version.get("enabled", False)),
            "entries": entries,
        },
        "signature_page": {
            "enabled": bool(signature.get("enabled", False)),
            "signatories": signatories,
            "note": str(signature.get("note", "")).strip(),
        },
        "footer_bar": {
            "enabled": bool(footer.get("enabled", False)),
            "note": str(footer.get("note", "")).strip(),
            "align": "center" if str(footer.get("align", "")).strip().lower() == "center" else "left",
        },
    }


def _build_pdf_notification_payload(
    *,
    record: Any,
    trigger_config: Dict[str, Any],
    record_id: str,
    version_id: str,
    output_key: str,
) -> Dict[str, Any] | None:
    recipient_user_ids = _dedupe_user_ids(
        [
            getattr(record, "prepared_by_user_id", None),
            getattr(record, "created_by", None),
            getattr(record, "updated_by", None),
        ]
    )
    actor_user_id = str(
        getattr(record, "updated_by", None)
        or getattr(record, "prepared_by_user_id", None)
        or getattr(record, "created_by", None)
        or ""
    ).strip() or None
    is_published = str(trigger_config.get("minio_bucket")) == "minuetaitor-published"

    if not is_published:
        return None

    notification_type = "minute.publication.pdf_ready"
    title = "PDF final disponible"
    message = f'El PDF final de "{getattr(record, "title", "la minuta")}" quedó disponible.'
    tags = ["minute", "pdf", "publication", "minute.publication.pdf_ready"]
    action_url = f"/minutes/view/{record_id}"

    return {
        "notificationType": notification_type,
        "title": title,
        "message": message,
        "level": "success",
        "tags": tags,
        "recipientUserIds": recipient_user_ids,
        "scopeType": "record",
        "scopeId": record_id,
        "actionUrl": action_url,
        "actorUserId": actor_user_id,
        "metadata": {
            "recordId": record_id,
            "versionId": version_id,
            "bucket": trigger_config.get("minio_bucket"),
            "outputKey": output_key,
            "trigger": trigger_config.get("trigger"),
        },
    }


def _build_post_publish_email_payload(record: Any, trigger_config: Dict[str, Any]) -> Dict[str, Any]:
    is_published = str(trigger_config.get("minio_bucket")) == "minuetaitor-published"
    project = getattr(record, "project", None)
    enabled = bool(is_published and getattr(project, "auto_send_on_completed", False))
    actor_user_id = str(
        getattr(record, "updated_by", None)
        or getattr(record, "prepared_by_user_id", None)
        or getattr(record, "created_by", None)
        or ""
    ).strip() or None
    return {
        "enabled": enabled,
        "actor_user_id": actor_user_id,
    }


def _dedupe_user_ids(values: List[Any]) -> List[str]:
    seen: set[str] = set()
    clean: List[str] = []
    for value in values:
        item = str(value or "").strip()
        if not item or item in seen:
            continue
        seen.add(item)
        clean.append(item)
    return clean


# ---------------------------------------------------------------------------
# Mapeos desde formato editor (draft_current.json)
# Claves en formato del store Zustand (camelCase frontend → snake_case Jinja2)
# ---------------------------------------------------------------------------

def _map_general_info_from_draft(draft: Dict[str, Any]) -> Dict[str, Any]:
    mi = draft.get("meetingInfo", {})
    mt = draft.get("meetingTimes", {})
    return {
        "client":               mi.get("client", ""),
        "project":              mi.get("project", ""),
        "subject":              mi.get("subject", ""),
        "meeting_date":         mi.get("meetingDate", ""),
        "prepared_by":          mi.get("preparedBy", ""),
        "location":             mi.get("location", ""),
        "scheduled_start_time": mt.get("scheduledStart", ""),
        "scheduled_end_time":   mt.get("scheduledEnd", ""),
        "actual_start_time":    mt.get("actualStart", ""),
        "actual_end_time":      mt.get("actualEnd", ""),
    }


def _map_participants_from_draft(draft: Dict[str, Any]) -> Dict[str, Any]:
    """
    Draft format: participants[].type = "invited" | "attendee" | "copy"
    Template expects: invited[], attendees[], copy_recipients[]
    """
    all_p = draft.get("participants", [])

    def norm(p: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "full_name": p.get("fullName", ""),
            "initials":  p.get("initials", ""),
            "role":      p.get("role", ""),
        }

    return {
        "invited":         [norm(p) for p in all_p if p.get("type") == "invited"],
        "attendees":       [norm(p) for p in all_p if p.get("type") == "attendee"],
        "copy_recipients": [norm(p) for p in all_p if p.get("type") == "copy"],
    }


def _map_scope_from_draft(draft: Dict[str, Any]) -> Dict[str, Any]:
    """
    Draft format: scopeSections[].topicsList = [{ id, text }]
    Template expects: sections[].content.topics_list = [str]
    """
    sections = []
    for sec in draft.get("scopeSections", []):
        topics_raw  = sec.get("topicsList", [])
        topics_list = [
            t.get("text", "") if isinstance(t, dict) else str(t)
            for t in topics_raw
        ]
        sections.append({
            "section_id":    sec.get("id", ""),
            "section_title": sec.get("title", ""),
            "section_type":  sec.get("type", ""),
            "content": {
                "summary":     sec.get("summary", ""),
                "topics_list": topics_list,
                "details":     sec.get("details", []),   # [{id, label, description}]
            },
        })
    return {"sections": sections}


def _map_agreements_from_draft(draft: Dict[str, Any]) -> Dict[str, Any]:
    items = []
    for item in draft.get("agreements", []):
        items.append({
            "subject":     item.get("subject", ""),
            "body":        item.get("body", ""),
            "responsible": item.get("responsible", ""),
            "due_date":    item.get("dueDate", item.get("due_date", "")),
            "status":      item.get("status", "pending"),
        })
    return {"items": items}


def _map_requirements_from_draft(draft: Dict[str, Any]) -> Dict[str, Any]:
    items = []
    for item in draft.get("requirements", []):
        items.append({
            "entity":      item.get("entity", ""),
            "body":        item.get("body", ""),
            "responsible": item.get("responsible", ""),
            "priority":    item.get("priority", "medium"),
            "status":      item.get("status", "open"),
        })
    return {"items": items}


def _map_upcoming_meetings_from_draft(draft: Dict[str, Any]) -> Dict[str, Any]:
    items = []
    for item in draft.get("upcomingMeetings", []):
        items.append({
            "scheduled_date": item.get("scheduledDate", ""),
            "agenda":         item.get("agenda", ""),
            "attendees":      item.get("attendees", []),
        })
    return {"items": items}

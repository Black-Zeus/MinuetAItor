# services/minutes_service.py
from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import openai

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.config import settings
from db.minio_client import get_minio_client
from models.minute_transaction import MinuteTransaction
from models.objects import Object
from models.record_artifacts import RecordArtifact
from models.record_versions import RecordVersion
from models.records import Record
from schemas.minutes import (
    MinuteDetailResponse,
    MinuteGenerateRequest,
    MinuteGenerateResponse,
    MinuteRecordInfo,
    MinuteStatusResponse,
    MinuteTransitionResponse,
)
from models.record_version_participant import RecordVersionParticipant

logger = logging.getLogger(__name__)

# ─── Constantes de catálogo ───────────────────────────────────────────────────
BUCKET_CODE_INPUTS    = "inputs_container"
BUCKET_CODE_JSON      = "json_container"
BUCKET_CODE_PUBLISHED = "published_container"
BUCKET_CODE_DRAFT     = "draft_container"

BUCKET_INPUTS    = "minuetaitor-inputs"
BUCKET_JSON      = "minuetaitor-json"
BUCKET_PUBLISHED = "minuetaitor-published"
BUCKET_DRAFT     = "minuetaitor-draft"

ART_INPUT_TRANSCRIPT = "INPUT_TRANSCRIPT"
ART_INPUT_SUMMARY    = "INPUT_SUMMARY"
ART_LLM_JSON_ORIG    = "LLM_JSON_ORIGINAL"
ART_CANONICAL_JSON   = "CANONICAL_JSON"

ART_STATE_ORIGINAL = "ORIGINAL"
ART_STATE_READY    = "READY"
ART_STATE_FAILED   = "FAILED"

RECORD_TYPE_MINUTE        = "MINUTE"
RECORD_STATUS_IN_PROGRESS = "in-progress"
RECORD_STATUS_READY       = "ready-for-edit"
RECORD_STATUS_LLM_FAILED  = "llm-failed"
RECORD_STATUS_PROC_ERROR  = "processing-error"
RECORD_STATUS_PENDING     = "pending"
RECORD_STATUS_PREVIEW     = "preview"
RECORD_STATUS_COMPLETED   = "completed"
RECORD_STATUS_CANCELLED   = "cancelled"
RECORD_STATUS_DELETED     = "deleted"
VERSION_STATUS_SNAPSHOT   = "snapshot"
VERSION_STATUS_FINAL      = "final"

# Estados sin contenido disponible (content = null en GET detail)
_STATUSES_NO_CONTENT = {RECORD_STATUS_LLM_FAILED, RECORD_STATUS_PROC_ERROR, "in-progress"}

# Matriz de transiciones válidas: origen → set de destinos permitidos
_VALID_TRANSITIONS: dict[str, set[str]] = {
    RECORD_STATUS_READY:      {RECORD_STATUS_PENDING, RECORD_STATUS_DELETED},
    RECORD_STATUS_PENDING:    {RECORD_STATUS_PREVIEW, RECORD_STATUS_CANCELLED, RECORD_STATUS_DELETED},
    RECORD_STATUS_PREVIEW:    {RECORD_STATUS_PENDING, RECORD_STATUS_COMPLETED, RECORD_STATUS_CANCELLED, RECORD_STATUS_DELETED},
    RECORD_STATUS_CANCELLED:  {RECORD_STATUS_DELETED},
    RECORD_STATUS_LLM_FAILED: {RECORD_STATUS_DELETED},
    RECORD_STATUS_PROC_ERROR: {RECORD_STATUS_DELETED},
    # Terminales sin transición:
    RECORD_STATUS_COMPLETED:  set(),
    RECORD_STATUS_DELETED:    set(),
}

# Cola Redis para jobs de PDF
QUEUE_PDF = "queue:pdf"

PROMPT_FILE      = settings.openai_system_prompt
PROMPT_PATH_BASE = Path("/app/assets/prompts")
TRACE_BASE_DIR   = "/app/assets/temp"


# ─── Helpers internos ────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _ext_from_filename(fname: str) -> str:
    if "." in fname:
        return fname.rsplit(".", 1)[-1].lower()
    return "bin"


_MIME_NORMALIZE: dict[str, str] = {
    "text/plain":                    "text/plain",
    "text/plain; charset=utf8":      "text/plain",
    "text/plain;charset=utf-8":      "text/plain",
    "text/plain;charset=utf8":       "text/plain",
    "application/json":              "application/json",
    "application/pdf":               "application/pdf",
    "image/png":                     "image/png",
    "image/jpeg":                    "image/jpeg",
    "image/jpg":                     "image/jpeg",
}


def _normalize_mime(mime: str) -> str:
    normalized = _MIME_NORMALIZE.get(mime.strip().lower())
    if normalized:
        return normalized
    logger.warning(f"[minutes] MIME no normalizado: '{mime}'")
    return mime


def _get_catalog_id(db: Session, model_class, code: str):
    obj = db.query(model_class).filter_by(code=code).first()
    if obj is None:
        raise RuntimeError(
            f"Catálogo '{model_class.__tablename__}' con code='{code}' "
            f"no encontrado en BD. Verifica los seeds."
        )
    return obj.id


def _get_ai_profile_data(db: Session, profile_id: str) -> dict:
    from models.ai_profiles import AiProfile
    profile = db.query(AiProfile).filter(
        AiProfile.id == profile_id,
        AiProfile.deleted_at.is_(None),
    ).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "invalid_ai_profile", "message": f"Perfil '{profile_id}' no existe o está inactivo"},
        )
    return {
        "profile_id":          profile.id,
        "profile_name":        profile.name,
        "profile_description": profile.description or "",
        "profile_prompt":      profile.prompt or "",
    }


def _parse_date(value: Optional[str]):
    if not value:
        return None
    try:
        from datetime import date
        return date.fromisoformat(value)
    except Exception:
        return None


def _parse_time(value: Optional[str]):
    if not value:
        return None
    try:
        from datetime import time
        parts = value.split(":")
        return time(int(parts[0]), int(parts[1]))
    except Exception:
        return None


def _build_object_row(obj_id, bucket_id, object_key, content_type, file_ext, size_bytes, sha256, created_by) -> Object:
    return Object(
        id=obj_id, bucket_id=bucket_id, object_key=object_key,
        content_type=content_type, file_ext=file_ext,
        size_bytes=size_bytes, sha256=sha256, created_by=created_by,
    )


def _build_artifact_row(
    record_id, artifact_type_id, artifact_state_id, object_id, created_by,
    record_version_id=None, is_draft=False, natural_name=None,
) -> RecordArtifact:
    return RecordArtifact(
        record_id=record_id,
        artifact_type_id=artifact_type_id,
        artifact_state_id=artifact_state_id,
        object_id=object_id,
        record_version_id=record_version_id,
        is_draft=is_draft,
        natural_name=natural_name,
        created_by=created_by,
    )


def _resolve_record_status_code(db: Session, record: Record) -> str:
    """Resuelve el código de estado del record desde BD."""
    from models.record_statuses import RecordStatus
    row = db.query(RecordStatus).filter_by(id=record.status_id).first()
    return row.code if row else "unknown"


# ─── Trazabilidad ─────────────────────────────────────────────────────────────

def _init_trace_dir(transaction_id: str, record_id: str) -> str:
    ts        = datetime.now().strftime("%Y%m%d_%H%M%S")
    trace_dir = os.path.join(TRACE_BASE_DIR, f"{ts}_{transaction_id[:8]}")
    os.makedirs(trace_dir, exist_ok=True)
    meta = {"transaction_id": transaction_id, "record_id": record_id,
            "created_at": _now_utc().isoformat(), "status": "started"}
    with open(os.path.join(trace_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    return trace_dir


def _save_trace_input(trace_dir: str, ai_input: dict, prompt_system: str) -> None:
    with open(os.path.join(trace_dir, "ai_input.json"), "w", encoding="utf-8") as f:
        json.dump(ai_input, f, ensure_ascii=False, indent=2)
    with open(os.path.join(trace_dir, PROMPT_FILE), "w", encoding="utf-8") as f:
        f.write(prompt_system)


def _save_trace_attachments(trace_dir: str, files_bytes: list[tuple[str, bytes, str]]) -> None:
    attachments_dir = os.path.join(trace_dir, "attachments")
    os.makedirs(attachments_dir, exist_ok=True)
    index = []
    for fname, raw, mime in files_bytes:
        with open(os.path.join(attachments_dir, fname), "wb") as f:
            f.write(raw)
        index.append({"fileName": fname, "mimeType": mime, "sizeBytes": len(raw), "sha256": _sha256_bytes(raw)})
    with open(os.path.join(attachments_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


def _save_trace_output(trace_dir: str, ai_output: dict, validation_status: str, missing_sections=None) -> None:
    result = {"received_at": _now_utc().isoformat(), "validation_status": validation_status, "ai_output": ai_output}
    if missing_sections:
        result["missing_sections"] = missing_sections
    with open(os.path.join(trace_dir, "ai_output.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


def _finalize_trace(trace_dir: str, final_status: str, error: Optional[str] = None) -> None:
    meta_path = os.path.join(trace_dir, "meta.json")
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
    except Exception:
        meta = {}
    meta["status"]       = final_status
    meta["finalized_at"] = _now_utc().isoformat()
    if error:
        meta["error"] = error
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


# ─── Commit helper para estado fallido ───────────────────────────────────────

def _commit_failed_state(db, tx, record, error_message, record_status, transaction_id, record_id):
    try:
        from models.record_statuses import RecordStatus
        tx     = db.merge(tx)
        record = db.merge(record)
        failed_status_id  = _get_catalog_id(db, RecordStatus, record_status)
        tx.status         = "failed"
        tx.error_message  = error_message
        record.status_id  = failed_status_id
        db.commit()
        logger.info(f"[minutes] Estado fallido commiteado | tx={transaction_id} record_status={record_status}")
    except Exception as e:
        logger.error(f"[minutes] CRÍTICO: no se pudo commitear estado fallido | tx={transaction_id} error={e}", exc_info=True)


# ─── OpenAI ───────────────────────────────────────────────────────────────────

def _model_supports_file_blocks(model: str) -> bool:
    return any(model.startswith(p) for p in ("gpt-4o", "gpt-4-turbo", "gpt-4.1"))


def _calculate_prompt_sha() -> str:
    try:
        p = PROMPT_PATH_BASE / PROMPT_FILE
        if not p.exists():
            return f"file_not_found_{PROMPT_FILE}"
        with open(p, "rb") as f:
            return _sha256_bytes(f.read())
    except Exception as e:
        return f"error_calculating_sha_{PROMPT_FILE}"


def _call_openai(prompt_system, files_for_openai, ai_input, trace_dir) -> tuple[dict, str, int, int]:
    _FILE_BLOCK_MIMES = {"application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"}
    use_file_blocks   = _model_supports_file_blocks(settings.openai_model)

    content_parts: list[dict] = [{"type": "text", "text": json.dumps(ai_input, ensure_ascii=False)}]

    for fname, raw, mime in files_for_openai:
        if use_file_blocks and mime in _FILE_BLOCK_MIMES:
            b64 = base64.b64encode(raw).decode("utf-8")
            if mime.startswith("image/"):
                content_parts.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}})
            else:
                content_parts.append({"type": "file", "file": {"filename": fname, "file_data": f"data:{mime};base64,{b64}"}})
        else:
            text_content = raw.decode("utf-8", errors="replace")
            content_parts.append({"type": "text", "text": f"--- Archivo: {fname} ---\n{text_content}\n--- Fin: {fname} ---"})

    client_oa = openai.OpenAI(api_key=settings.openai_api_key)
    response  = client_oa.chat.completions.create(
        model=settings.openai_model, max_tokens=settings.openai_max_tokens,
        temperature=settings.openai_temperature,
        messages=[{"role": "system", "content": prompt_system}, {"role": "user", "content": content_parts}],
    )

    raw_text = (response.choices[0].message.content or "").strip()
    if raw_text.startswith("```"):
        lines    = raw_text.split("\n")
        raw_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    usage = getattr(response, "usage", None)
    if usage:
        total = getattr(usage, "total_tokens", 0)
        limit = getattr(settings, "openai_context_limit", 128_000)
        if total >= int(limit * 0.95):
            raise ValueError(
                "La sesión es demasiado extensa para procesarse en un solo archivo. "
                "Te recomendamos dividirla en dos partes y generar una minuta por cada parte."
            )

    try:
        parsed     = json.loads(raw_text)
        tokens_in  = getattr(usage, "prompt_tokens",     0) if usage else 0
        tokens_out = getattr(usage, "completion_tokens", 0) if usage else 0
        return parsed, response.id, tokens_in, tokens_out
    except json.JSONDecodeError as e:
        raise RuntimeError(f"La IA retornó un JSON inválido: {e}")


def _build_ai_input_schema(request, transaction_id, file_metadata) -> dict:
    mi, pi, pa, pr = request.meeting_info, request.project_info, request.participants, request.profile_info
    schema: dict = {
        "transactionId": transaction_id, "attachments": file_metadata,
        "meetingInfo": {"scheduledDate": mi.scheduled_date, "scheduledStartTime": mi.scheduled_start_time, "scheduledEndTime": mi.scheduled_end_time},
        "projectInfo": {"client": pi.client, "clientID": pi.client_id, "project": pi.project, "projectID": pi.project_id},
        "declaredParticipants": {"attendees": pa.attendees, "note": "Lista declarada por el usuario. Puede estar incompleta. Extraer participantes reales desde los archivos adjuntos."},
        "profileInfo": {"profileId": pr.profile_id, "profileName": pr.profile_name},
        "preparedBy": request.prepared_by,
        "systemPrompt": {"name": PROMPT_FILE, "signedSha": _calculate_prompt_sha()},
    }
    if mi.actual_start_time: schema["meetingInfo"]["actualStartTime"] = mi.actual_start_time
    if mi.actual_end_time:   schema["meetingInfo"]["actualEndTime"]   = mi.actual_end_time
    if mi.location:          schema["meetingInfo"]["location"]        = mi.location
    if mi.title:             schema["meetingInfo"]["title"]           = mi.title
    if pi.category:          schema["projectInfo"]["category"]        = pi.category
    if pa.invited:           schema["declaredParticipants"]["invited"] = pa.invited
    if pa.copy_recipients:   schema["declaredParticipants"]["copyRecipients"] = pa.copy_recipients
    if request.additional_notes:    schema["additionalNotes"]   = request.additional_notes
    if request.generation_options:  schema["generationOptions"] = {"language": request.generation_options.language}
    return schema


def _reload_files_from_minio(minio, bucket, record_id, file_metadata):
    result = []
    for meta in file_metadata:
        fname, mime = meta["fileName"], meta["mimeType"]
        obj_key = f"{record_id}/{fname}"
        try:
            response = minio.get_object(bucket, obj_key)
            raw      = response.read()
            response.close()
            response.release_conn()
            result.append((fname, raw, mime))
        except Exception as e:
            logger.warning(f"[minutes] No se pudo recargar {obj_key}: {e}")
    return result


def _load_agent_prompt(profile_id, profile_name, profile_description, profile_prompt, additional_notes="", user_tags="") -> str:
    prompt_path = PROMPT_PATH_BASE / PROMPT_FILE
    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            template = f.read()
        prompt = template
        prompt = prompt.replace("{profileId}",          profile_id)
        prompt = prompt.replace("{profileName}",        profile_name)
        prompt = prompt.replace("{profileDescription}", profile_description)
        prompt = prompt.replace("{profilePrompt}",      profile_prompt or "Analiza la reunión de forma general y objetiva.")
        prompt = prompt.replace("{additionalNotes}",    additional_notes or "Sin notas adicionales.")
        prompt = prompt.replace("{userTags}",           user_tags or "Sin tags proporcionados.")
        return prompt
    return (
        f"Eres un asistente especializado en generar minutas. "
        f"Perfil: {profile_name}. {profile_description}. "
        f"Genera el JSON de la minuta siguiendo el esquema exacto requerido."
    )


# ─── Helper MinIO: leer / escribir JSON ──────────────────────────────────────

def _read_json_from_minio(minio, bucket: str, object_key: str) -> Optional[dict]:
    try:
        response = minio.get_object(bucket, object_key)
        raw      = response.read()
        response.close()
        response.release_conn()
        return json.loads(raw.decode("utf-8"))
    except Exception as e:
        logger.warning(f"[minutes] No se pudo leer {bucket}/{object_key}: {e}")
        return None


def _write_json_to_minio(minio, bucket: str, object_key: str, data: dict) -> int:
    """Escribe un dict como JSON en MinIO. Retorna el tamaño en bytes."""
    raw = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    minio.put_object(
        bucket_name=bucket, object_name=object_key,
        data=io.BytesIO(raw), length=len(raw), content_type="application/json",
    )
    return len(raw)


# ─── Helper Redis: encolar job PDF ───────────────────────────────────────────

async def _enqueue_pdf_job(job: dict) -> None:
    """Encola un job de generación de PDF en queue:pdf."""
    from db.redis import get_redis
    redis = get_redis()
    await redis.rpush(QUEUE_PDF, json.dumps(job))
    logger.info(f"[minutes] PDF job encolado | type={job.get('type')} record={job.get('record_id')}")


# ─── generate_minute ─────────────────────────────────────────────────────────

async def generate_minute(
    db:              Session,
    request:         MinuteGenerateRequest,
    files:           list[UploadFile],
    requested_by_id: str,
) -> MinuteGenerateResponse:
    """
    Two-transaction pattern:
    TX1: Record (in-progress) + MinuteTransaction + Objects de input.
    TX2 OK:  record → ready-for-edit, version v1 (snapshot), artefactos.
    TX2 fail OpenAI: record → llm-failed.
    TX2 fail backend: record → processing-error.
    """
    from models.artifact_states  import ArtifactState
    from models.artifact_types   import ArtifactType
    from models.buckets          import Bucket
    from models.record_drafts    import RecordDraft
    from models.record_statuses  import RecordStatus
    from models.record_types     import RecordType
    from models.version_statuses import VersionStatus

    transaction_id = str(uuid.uuid4())
    record_id      = str(uuid.uuid4())
    now            = _now_utc()
    artefactos_output: list[RecordArtifact] = []
    file_metadata:     list[dict]           = []
    trace_dir:         Optional[str]        = None
    tx:     Optional[MinuteTransaction] = None
    record: Optional[Record]            = None
    openai_run_id = ""
    tokens_input  = 0
    tokens_output = 0

    logger.info(f"[minutes] Iniciando | record={record_id} tx={transaction_id}")

    try:
        trace_dir = _init_trace_dir(transaction_id, record_id)
    except Exception as e:
        logger.warning(f"[trace] {e}")

    record_type_id    = _get_catalog_id(db, RecordType,    RECORD_TYPE_MINUTE)
    record_status_id  = _get_catalog_id(db, RecordStatus,  RECORD_STATUS_IN_PROGRESS)
    version_status_id = _get_catalog_id(db, VersionStatus, VERSION_STATUS_SNAPSHOT)
    bucket_inputs_id  = _get_catalog_id(db, Bucket,        BUCKET_CODE_INPUTS)
    bucket_json_id    = _get_catalog_id(db, Bucket,        BUCKET_CODE_JSON)
    art_transcript_id = _get_catalog_id(db, ArtifactType,  ART_INPUT_TRANSCRIPT)
    art_summary_id    = _get_catalog_id(db, ArtifactType,  ART_INPUT_SUMMARY)
    art_canonical_id  = _get_catalog_id(db, ArtifactType,  ART_CANONICAL_JSON)
    state_original_id = _get_catalog_id(db, ArtifactState, ART_STATE_ORIGINAL)
    state_ready_id    = _get_catalog_id(db, ArtifactState, ART_STATE_READY)
    state_failed_id   = _get_catalog_id(db, ArtifactState, ART_STATE_FAILED)  # noqa

    profile_data  = _get_ai_profile_data(db, request.profile_info.profile_id)
    ai_profile_id = request.profile_info.profile_id
    client_id     = getattr(request.project_info, "client_id",  None) or None
    project_id    = getattr(request.project_info, "project_id", None) or None

    if not client_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "missing_client", "message": "Se requiere un cliente (clientID)"})

    record_title = (
        request.meeting_info.title
        or f"Reunión {request.project_info.client} – {request.meeting_info.scheduled_date}"
    )

    # ── TX1 ───────────────────────────────────────────────────────────────────
    record = Record(
        id=record_id, record_type_id=record_type_id, status_id=record_status_id,
        client_id=client_id, project_id=project_id, ai_profile_id=ai_profile_id,
        title=record_title,
        document_date=_parse_date(request.meeting_info.scheduled_date),
        location=request.meeting_info.location,
        scheduled_start_time=_parse_time(request.meeting_info.scheduled_start_time),
        scheduled_end_time=_parse_time(request.meeting_info.scheduled_end_time),
        actual_start_time=_parse_time(request.meeting_info.actual_start_time),
        actual_end_time=_parse_time(request.meeting_info.actual_end_time),
        prepared_by_user_id=requested_by_id, latest_version_num=0, created_by=requested_by_id,
    )
    db.add(record)

    tx = MinuteTransaction(
        id=transaction_id, record_id=record_id, status="pending",
        requested_by=requested_by_id, ai_profile_id=ai_profile_id, created_at=now,
    )
    db.add(tx)

    try:
        db.flush()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "database_integrity_error", "message": "Error al crear el registro."})

    minio               = get_minio_client()
    input_object_id:    Optional[str] = None
    input_objects_meta: list[dict]    = []

    for upload in files:
        raw   = await upload.read()
        sha   = _sha256_bytes(raw)
        fname = upload.filename or "archivo.txt"
        mime  = _normalize_mime(upload.content_type or "text/plain")
        ext   = _ext_from_filename(fname)
        fname_lower = fname.lower()
        art_type_id = art_summary_id if ("resumen" in fname_lower or "summary" in fname_lower) else art_transcript_id
        file_type   = "summary" if art_type_id == art_summary_id else "transcription"

        obj_key = f"{record_id}/{fname}"
        obj_id  = str(uuid.uuid4())
        minio.put_object(bucket_name=BUCKET_INPUTS, object_name=obj_key,
                         data=io.BytesIO(raw), length=len(raw), content_type=mime)
        db.add(_build_object_row(obj_id, bucket_inputs_id, obj_key, _normalize_mime(mime), ext, len(raw), sha, requested_by_id))
        input_objects_meta.append({"obj_id": obj_id, "art_type_id": art_type_id, "fname": fname})
        file_metadata.append({"fileName": fname, "mimeType": mime, "sha256": sha, "fileType": file_type})
        if input_object_id is None:
            input_object_id = obj_id

    tx.status          = "processing"
    tx.input_object_id = input_object_id
    tx.openai_model    = settings.openai_model

    try:
        db.commit()
        logger.info(f"[minutes] TX1 commiteada | record={record_id}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "tx1_commit_error", "message": "Error al persistir el intake."})

    # ── TX2 ───────────────────────────────────────────────────────────────────
    ai_input      = _build_ai_input_schema(request, transaction_id, file_metadata)
    prompt_system = _load_agent_prompt(
        profile_data["profile_id"], profile_data["profile_name"],
        profile_data["profile_description"], profile_data["profile_prompt"],
        request.additional_notes or "", "",
    )

    ai_output: Optional[dict] = None

    try:
        files_for_openai = _reload_files_from_minio(minio, BUCKET_INPUTS, record_id, file_metadata)
        if not files_for_openai:
            raise ValueError("No se pudieron recargar los archivos desde MinIO")
        if trace_dir:
            try: _save_trace_input(trace_dir, ai_input, prompt_system); _save_trace_attachments(trace_dir, files_for_openai)
            except Exception: pass

        ai_output, openai_run_id, tokens_input, tokens_output = _call_openai(prompt_system, files_for_openai, ai_input, trace_dir)

        if trace_dir:
            try: _save_trace_output(trace_dir, ai_output, "pending_validation")
            except Exception: pass

        required_top  = ["scope", "agreements", "requirements", "upcomingMeetings"]
        missing_top   = [k for k in required_top if k not in ai_output]
        missing_scope = ["scope.sections"] if ("scope" in ai_output and "sections" not in ai_output.get("scope", {})) else []
        missing = missing_top + missing_scope
        if missing:
            raise RuntimeError(f"Respuesta de IA incompleta. Secciones faltantes: {missing}")

    except openai.RateLimitError as e:
        db.rollback()
        _commit_failed_state(db, tx, record, f"OpenAI rate limit: {e}", RECORD_STATUS_LLM_FAILED, transaction_id, record_id)
        if trace_dir:
            try: _finalize_trace(trace_dir, "llm-failed", error=str(e))
            except Exception: pass
        raise HTTPException(status_code=503, detail={"error": "openai_rate_limit", "message": "Límite de OpenAI alcanzado."})

    except openai.APITimeoutError as e:
        db.rollback()
        _commit_failed_state(db, tx, record, f"OpenAI timeout: {e}", RECORD_STATUS_LLM_FAILED, transaction_id, record_id)
        if trace_dir:
            try: _finalize_trace(trace_dir, "llm-failed", error=str(e))
            except Exception: pass
        raise HTTPException(status_code=504, detail={"error": "openai_timeout", "message": "OpenAI no respondió a tiempo."})

    except (openai.BadRequestError, openai.AuthenticationError, openai.APIError) as e:
        db.rollback()
        _commit_failed_state(db, tx, record, f"OpenAI API error: {e}", RECORD_STATUS_LLM_FAILED, transaction_id, record_id)
        if trace_dir:
            try: _finalize_trace(trace_dir, "llm-failed", error=str(e))
            except Exception: pass
        raise HTTPException(status_code=502, detail={"error": "openai_api_error", "message": f"Error en OpenAI: {e}"})

    except Exception as e:
        db.rollback()
        _commit_failed_state(db, tx, record, f"Error en procesamiento: {e}", RECORD_STATUS_PROC_ERROR, transaction_id, record_id)
        if trace_dir:
            try: _finalize_trace(trace_dir, "processing-error", error=str(e))
            except Exception: pass
        raise HTTPException(status_code=500, detail={"error": "processing_error", "message": "Error interno al procesar la minuta."})

    # ── TX2 persistencia post-OpenAI ──────────────────────────────────────────
    try:
        canonical_bytes  = json.dumps(ai_output, ensure_ascii=False, indent=2).encode("utf-8")
        canonical_key    = f"{record_id}/schema_output_v1.json"
        canonical_obj_id = str(uuid.uuid4())
        minio.put_object(bucket_name=BUCKET_JSON, object_name=canonical_key,
                         data=io.BytesIO(canonical_bytes), length=len(canonical_bytes),
                         content_type="application/json")
        canonical_sha = _sha256_bytes(canonical_bytes)
        db.add(_build_object_row(canonical_obj_id, bucket_json_id, canonical_key,
                                  "application/json", "json", len(canonical_bytes),
                                  canonical_sha, requested_by_id))
        artefactos_output.append(_build_artifact_row(
            record_id, art_canonical_id, state_ready_id, canonical_obj_id,
            requested_by_id, is_draft=False
        ))
        if trace_dir:
            try: _save_trace_output(trace_dir, ai_output, "valid")
            except Exception: pass

        from models.record_statuses import RecordStatus
        record.status_id = _get_catalog_id(db, RecordStatus, RECORD_STATUS_READY)

        version_id = str(uuid.uuid4())
        from models.version_statuses import VersionStatus
        db.add(RecordVersion(id=version_id, record_id=record_id, version_num=1,
                             status_id=version_status_id, published_by=requested_by_id,
                             schema_version="1.0", template_version="1.0", ai_model=settings.openai_model))
        from models.record_drafts import RecordDraft
        db.add(RecordDraft(record_id=record_id, created_by=requested_by_id))
        db.flush()
        tx.record_version_id = version_id

        artefactos_input = []
        for meta in input_objects_meta:
            art = _build_artifact_row(record_id, meta["art_type_id"], state_original_id, meta["obj_id"],
                                       requested_by_id, record_version_id=version_id, is_draft=False, natural_name=meta["fname"])
            artefactos_input.append(art)
            db.add(art)

        for art in artefactos_output:
            if not art.is_draft:
                art.record_version_id = version_id
            db.add(art)

        db.flush(artefactos_input + artefactos_output)

        # ── Poblar RecordVersion con datos del output IA ──────────────────────
        from models.record_version_participant import RecordVersionParticipant
        from models.ai_tags import AITag
        from models.record_version_ai_tags import RecordVersionAiTag

        intro_section = next(
            (s for s in ai_output.get("scope", {}).get("sections", [])
             if s.get("sectionType") == "introduction"),
            None,
        )
        if intro_section:
            summary_text = intro_section.get("content", {}).get("summary")
            if summary_text:
                rv = db.query(RecordVersion).filter_by(id=version_id).first()
                if rv:
                    rv.summary_text = summary_text

        for attendee in ai_output.get("participants", {}).get("attendees", []):
            full_name = attendee.get("fullName") if isinstance(attendee, dict) else str(attendee)
            if full_name:
                db.add(RecordVersionParticipant(
                    record_version_id=version_id,
                    role="unknown",
                    display_name=full_name,
                ))

        for ai_tag in ai_output.get("aiSuggestedTags", []):
            slug = ai_tag.get("name", "").strip().lower()
            desc = ai_tag.get("description", "")
            if not slug:
                continue
            tag_row = db.query(AITag).filter_by(slug=slug).first()
            if not tag_row:
                tag_row = AITag(
                    id=str(uuid.uuid4()),
                    slug=slug,
                    description=desc,
                    is_active=True,
                    created_at=_now_utc(),
                )
                db.add(tag_row)
                db.flush()
            existing = db.query(RecordVersionAiTag).filter_by(
                record_version_id=version_id, ai_tag_id=tag_row.id,
            ).first()
            if not existing:
                db.add(RecordVersionAiTag(
                    record_version_id=version_id,
                    ai_tag_id=tag_row.id,
                    detected_at=_now_utc(),  # FIX: columna NOT NULL
                ))

        tx.status           = "completed"
        tx.completed_at     = _now_utc()
        tx.output_object_id = canonical_obj_id
        tx.openai_model     = settings.openai_model
        tx.openai_run_id    = openai_run_id
        tx.tokens_input     = tokens_input
        tx.tokens_output    = tokens_output
        record.active_version_id  = version_id
        record.latest_version_num = 1

        db.commit()
        logger.info(f"[minutes] TX2 commiteada | record={record_id} status=ready-for-edit version={version_id}")

    except Exception as e:
        logger.error(f"[minutes] Error en persistencia post-OpenAI | record={record_id}: {e}", exc_info=True)
        db.rollback()
        _commit_failed_state(db, tx, record, f"Error post-procesamiento: {e}",
                             RECORD_STATUS_PROC_ERROR, transaction_id, record_id)
        if trace_dir:
            try: _finalize_trace(trace_dir, "processing-error", error=str(e))
            except Exception: pass
        raise HTTPException(status_code=500,
            detail={"error": "processing_error", "message": "Error interno al guardar la minuta."})

    if trace_dir:
        try: _finalize_trace(trace_dir, "completed")
        except Exception: pass

    return MinuteGenerateResponse(
        transaction_id=transaction_id, record_id=record_id,
        status="ready-for-edit", message="Minuta generada exitosamente",
    )


# ─── PASO 3: get_minute_detail ────────────────────────────────────────────────

def get_minute_detail(db: Session, record_id: str) -> MinuteDetailResponse:
    from models.record_statuses import RecordStatus

    record = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if record is None:
        raise HTTPException(status_code=404,
            detail={"error": "record_not_found", "message": f"Minuta '{record_id}' no encontrada."})

    status_row  = db.query(RecordStatus).filter_by(id=record.status_id).first()
    status_code = status_row.code if status_row else "unknown"

    client_name  = getattr(getattr(record, "client",  None), "name", None)
    project_name = getattr(getattr(record, "project", None), "name", None)

    prepared_by_name = None
    prep_user = getattr(record, "prepared_by_user", None)
    if prep_user:
        profile = getattr(prep_user, "profile", None)
        prepared_by_name = getattr(profile, "full_name", None) or getattr(prep_user, "username", None)

    record_info = MinuteRecordInfo(
        id=record.id, status=status_code, title=record.title,
        client_id=str(record.client_id) if record.client_id else None,
        client_name=client_name,
        project_id=str(record.project_id) if record.project_id else None,
        project_name=project_name,
        active_version_id=str(record.active_version_id) if record.active_version_id else None,
        active_version_num=int(record.latest_version_num) if record.latest_version_num else None,
        document_date=record.document_date.isoformat() if record.document_date else None,
        location=record.location, prepared_by=prepared_by_name,
        created_at=record.created_at.isoformat() if getattr(record, "created_at", None) else None,
    )

    if status_code in _STATUSES_NO_CONTENT:
        return MinuteDetailResponse(record=record_info, content=None)

    minio       = get_minio_client()
    content     = None
    version_num = int(record.latest_version_num) if record.latest_version_num else 1

    if status_code == RECORD_STATUS_READY:
        content = _read_json_from_minio(minio, BUCKET_JSON, f"{record_id}/schema_output_v1.json")
    elif status_code == RECORD_STATUS_PENDING:
        content = _read_json_from_minio(minio, BUCKET_DRAFT, f"{record_id}/draft_current.json")
        if content is None:
            logger.warning(f"[minutes] Fallback a schema_output_v1.json | record={record_id}")
            content = _read_json_from_minio(minio, BUCKET_JSON, f"{record_id}/schema_output_v1.json")
    elif status_code in (RECORD_STATUS_PREVIEW, RECORD_STATUS_COMPLETED):
        content = _read_json_from_minio(minio, BUCKET_JSON, f"{record_id}/schema_output_v{version_num}.json")
    else:
        logger.warning(f"[minutes] Estado inesperado '{status_code}' → content=null | record={record_id}")

    return MinuteDetailResponse(record=record_info, content=content)


# ─── PASO 4: save_minute_draft ────────────────────────────────────────────────

def save_minute_draft(db: Session, record_id: str, content: dict) -> None:
    from models.record_statuses import RecordStatus

    record = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if record is None:
        raise HTTPException(status_code=404,
            detail={"error": "record_not_found", "message": f"Minuta '{record_id}' no encontrada."})

    status_row  = db.query(RecordStatus).filter_by(id=record.status_id).first()
    status_code = status_row.code if status_row else "unknown"

    if status_code != RECORD_STATUS_PENDING:
        raise HTTPException(status_code=409,
            detail={"error": "invalid_status_for_save",
                    "message": f"El autosave solo está disponible en estado 'pending'. Estado actual: '{status_code}'."})

    try:
        draft_bytes = json.dumps(content, ensure_ascii=False, indent=2).encode("utf-8")
        object_key  = f"{record_id}/draft_current.json"
        minio = get_minio_client()
        minio.put_object(bucket_name=BUCKET_DRAFT, object_name=object_key,
                         data=io.BytesIO(draft_bytes), length=len(draft_bytes), content_type="application/json")
        logger.debug(f"[minutes] draft guardado | record={record_id} size={len(draft_bytes)}B")
    except Exception as e:
        logger.error(f"[minutes] Error guardando draft | record={record_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500,
            detail={"error": "minio_write_error", "message": "Error al guardar el borrador."})


# ─── PASO 5: transition_minute ────────────────────────────────────────────────

async def transition_minute(
    db:             Session,
    record_id:      str,
    target_status:  str,
    commit_message: Optional[str],
    actor_user_id:  str,
) -> MinuteTransitionResponse:
    """
    Cambia el estado de una minuta aplicando la lógica propia de cada transición.

    Matriz de transiciones válidas:
      ready-for-edit  → pending, deleted
      pending         → preview, cancelled, deleted
      preview         → pending, completed, cancelled, deleted
      cancelled       → deleted
      llm-failed      → deleted
      processing-error → deleted
      completed       → (ninguna, terminal)
      deleted         → (ninguna, terminal)

    Cada transición puede involucrar:
      - Lecturas/escrituras en MinIO (copiar draft, crear snapshot)
      - Creación de RecordVersion nueva
      - Encolado de job PDF al worker
      - Actualización de record.status_id, active_version_id, latest_version_num
    """
    from models.record_statuses  import RecordStatus
    from models.version_statuses import VersionStatus
    from models.buckets          import Bucket

    # ── Cargar record ─────────────────────────────────────────────────────────
    record = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if record is None:
        raise HTTPException(status_code=404,
            detail={"error": "record_not_found", "message": f"Minuta '{record_id}' no encontrada."})

    current_status_row  = db.query(RecordStatus).filter_by(id=record.status_id).first()
    current_status_code = current_status_row.code if current_status_row else "unknown"

    # ── Validar transición ────────────────────────────────────────────────────
    allowed = _VALID_TRANSITIONS.get(current_status_code, set())
    if target_status not in allowed:
        raise HTTPException(status_code=409,
            detail={
                "error":   "invalid_transition",
                "message": (
                    f"No se puede transicionar de '{current_status_code}' a '{target_status}'. "
                    f"Transiciones válidas: {sorted(allowed) or 'ninguna (estado terminal)'}."
                ),
            })

    # ── Resolver IDs de catálogo necesarios ───────────────────────────────────
    target_status_id   = _get_catalog_id(db, RecordStatus,  target_status)
    snapshot_status_id = _get_catalog_id(db, VersionStatus, VERSION_STATUS_SNAPSHOT)
    final_status_id    = _get_catalog_id(db, VersionStatus, VERSION_STATUS_FINAL)
    bucket_json_id     = _get_catalog_id(db, Bucket,        BUCKET_CODE_JSON)

    minio       = get_minio_client()
    new_version: Optional[RecordVersion] = None  # se asigna si la transición crea versión

    # ══════════════════════════════════════════════════════════════════════════
    # LÓGICA POR TRANSICIÓN
    # ══════════════════════════════════════════════════════════════════════════

    # ── ready-for-edit → pending ──────────────────────────────────────────────
    if current_status_code == RECORD_STATUS_READY and target_status == RECORD_STATUS_PENDING:
        """
        1. Leer schema_output_v1.json desde minuetaitor-json
        2. Escribir como draft_current.json en minuetaitor-draft
        3. Crear RecordVersion v2 (snapshot) apuntando al mismo object que v1
        4. record.active_version_id = v2, latest_version_num = 2
        5. record.status = pending
        ## TODO: Notificar — ready-for-edit → pending ##
        """
        # 1. Leer v1 desde json_container
        source_key = f"{record_id}/schema_output_v1.json"
        content    = _read_json_from_minio(minio, BUCKET_JSON, source_key)
        if content is None:
            raise HTTPException(status_code=500,
                detail={"error": "content_not_found",
                        "message": f"No se encontró el contenido base ({source_key})."})

        # 2. Escribir draft_current.json
        _write_json_to_minio(minio, BUCKET_DRAFT, f"{record_id}/draft_current.json", content)
        logger.info(f"[minutes] draft_current.json inicializado | record={record_id}")

        # 3. Crear RecordVersion v2 (snapshot) — apunta al mismo JSON v1 en MinIO
        #    (no hay nuevo object, el snapshot referencia el mismo artifact semánticamente)
        new_version_num = int(record.latest_version_num) + 1
        new_version_id  = str(uuid.uuid4())
        new_version = RecordVersion(
            id=new_version_id, record_id=record_id,
            version_num=new_version_num, status_id=snapshot_status_id,
            published_by=actor_user_id, schema_version="1.0", template_version="1.0",
        )
        db.add(new_version)
        db.flush()

        # 4. Actualizar record
        record.active_version_id  = new_version_id
        record.latest_version_num = new_version_num

    # ── pending → preview ─────────────────────────────────────────────────────
    elif current_status_code == RECORD_STATUS_PENDING and target_status == RECORD_STATUS_PREVIEW:
        """
        1. Leer draft_current.json desde minuetaitor-draft
        2. Calcular vN = latest_version_num + 1
        3. Guardar schema_output_vN.json en minuetaitor-json (snapshot inmutable)
        4. Crear RecordVersion vN (snapshot)
        5. record.active_version_id = vN, latest_version_num = N
        6. record.status = preview
        7. Encolar worker: generar draft_vN.pdf con marca de agua "BORRADOR"
        ## TODO: Notificar — pending → preview ##
        """
        # 1. Leer draft activo
        draft_content = _read_json_from_minio(minio, BUCKET_DRAFT, f"{record_id}/draft_current.json")
        if draft_content is None:
            raise HTTPException(status_code=500,
                detail={"error": "draft_not_found", "message": "No se encontró el draft activo."})

        # 2-3. Guardar snapshot inmutable en json_container
        new_version_num = int(record.latest_version_num) + 1
        snapshot_key    = f"{record_id}/schema_output_v{new_version_num}.json"
        snap_size       = _write_json_to_minio(minio, BUCKET_JSON, snapshot_key, draft_content)
        logger.info(f"[minutes] Snapshot guardado: {BUCKET_JSON}/{snapshot_key} ({snap_size}B)")

        # Registrar el nuevo object en BD
        snap_obj_id = str(uuid.uuid4())
        snap_sha    = _sha256_bytes(json.dumps(draft_content, ensure_ascii=False, indent=2).encode("utf-8"))
        db.add(_build_object_row(snap_obj_id, bucket_json_id, snapshot_key,
                                  "application/json", "json", snap_size, snap_sha, actor_user_id))
        db.flush()  # necesario para que el FK de RecordVersion sea válido si lo usamos luego

        # 4. Crear RecordVersion vN
        new_version_id  = str(uuid.uuid4())
        new_version = RecordVersion(
            id=new_version_id, record_id=record_id,
            version_num=new_version_num, status_id=snapshot_status_id,
            published_by=actor_user_id, schema_version="1.0", template_version="1.0",
        )
        db.add(new_version)
        db.flush()

        # 5. Actualizar record
        record.active_version_id  = new_version_id
        record.latest_version_num = new_version_num

        # 7. Encolar PDF borrador (async — no bloquea la transición)
        try:
            await _enqueue_pdf_job({
                "type":        "generate_draft_pdf",
                "record_id":   record_id,
                "version_num": new_version_num,
                "watermark":   "BORRADOR",
            })
        except Exception as e:
            # No falla la transición si el encolado falla — el PDF se puede regenerar
            logger.warning(f"[minutes] No se pudo encolar PDF borrador | record={record_id}: {e}")

    # ── preview → pending ─────────────────────────────────────────────────────
    elif current_status_code == RECORD_STATUS_PREVIEW and target_status == RECORD_STATUS_PENDING:
        """
        1. record.status = pending
        (draft_current.json ya tiene el último contenido — no se toca)
        ## TODO: Notificar — preview → pending ##
        """
        pass  # solo cambia el status, sin operaciones adicionales

    # ── preview → completed ───────────────────────────────────────────────────
    elif current_status_code == RECORD_STATUS_PREVIEW and target_status == RECORD_STATUS_COMPLETED:
        """
        1. record.status = completed
        2. Encolar worker: generar final_vN.pdf sin marca de agua
        ## TODO: Notificar — preview → completed (email a participantes) ##
        """
        version_num = int(record.latest_version_num)

        # Actualizar la versión activa a status 'final'
        active_version = db.query(RecordVersion).filter_by(id=record.active_version_id).first()
        if active_version:
            active_version.status_id = final_status_id

        try:
            await _enqueue_pdf_job({
                "type":        "generate_final_pdf",
                "record_id":   record_id,
                "version_num": version_num,
            })
        except Exception as e:
            logger.warning(f"[minutes] No se pudo encolar PDF final | record={record_id}: {e}")

    # ── * → cancelled ─────────────────────────────────────────────────────────
    elif target_status == RECORD_STATUS_CANCELLED:
        """
        1. record.status = cancelled
        ## TODO: Notificar — {origen} → cancelled ##
        """
        pass  # solo cambia el status

    # ── * → deleted ───────────────────────────────────────────────────────────
    elif target_status == RECORD_STATUS_DELETED:
        """
        1. record.deleted_at = now()
        2. record.status = deleted
        ## TODO: Notificar — {origen} → deleted ##
        """
        record.deleted_at = _now_utc()

    # ── Aplicar nuevo status ──────────────────────────────────────────────────
    record.status_id   = target_status_id
    record.updated_by  = actor_user_id

    db.commit()

    version_num_result = int(record.latest_version_num) if new_version else None
    version_id_result  = new_version.id if new_version else None

    logger.info(
        f"[minutes] Transición completada | record={record_id} "
        f"{current_status_code} → {target_status}"
        + (f" v{version_num_result}" if version_num_result else "")
    )

    return MinuteTransitionResponse(
        record_id   = record_id,
        status      = target_status,
        version_num = version_num_result,
        version_id  = version_id_result,
        message     = f"Transición '{current_status_code}' → '{target_status}' completada.",
    )


# ─── get_minute_status (polling generate) ────────────────────────────────────

async def get_minute_status(db: Session, transaction_id: str) -> MinuteStatusResponse:
    tx = db.query(MinuteTransaction).filter_by(id=transaction_id).first()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction no encontrada")

    def _fmt(dt):
        return dt.isoformat() if dt and hasattr(dt, "isoformat") else None

    return MinuteStatusResponse(
        transaction_id=tx.id, record_id=tx.record_id, status=tx.status,
        error_message=tx.error_message,
        created_at=_fmt(tx.created_at), updated_at=_fmt(getattr(tx, "updated_at", None)),
        completed_at=_fmt(tx.completed_at),
    )

# Paleta de colores para tags según category_id (cíclica)
_TAG_COLORS = [
    "#FF1744", "#F50057", "#C51162", "#FF4081", "#E91E63",
    "#FF9100", "#FF6D00", "#FF3D00", "#FFAB00", "#FFC400",
    "#FFEA00", "#C6FF00", "#B2FF59", "#76FF03", "#64DD17",
    "#00E676", "#00C853", "#69F0AE", "#1DE9B6", "#00BFA5",
    "#00E5FF", "#00B0FF", "#2979FF", "#304FFE", "#3D5AFE",
    "#AA00FF", "#D500F9", "#E040FB", "#7C4DFF", "#651FFF",
    "#C2185B", "#AD1457", "#6A1B9A", "#4A148C", "#311B92",
    "#00BFA5", "#1DE9B6", "#FF80AB", "#FF9E80", "#B388FF",
    "#FFD180", "#FFFF8D", "#CFD8DC", "#B0BEC5", "#90A4AE"
]

def _tag_color(category_id: int) -> str:
    hash_value = hashlib.md5(str(category_id).encode()).hexdigest()
    index = int(hash_value, 16) % len(_TAG_COLORS)
    return _TAG_COLORS[index]


def list_minutes(
    db:    Session,
    skip:  int = 0,
    limit: int = 50,
    status_filter: Optional[str] = None,
    client_id:     Optional[str] = None,
    project_id:    Optional[str] = None,
) -> dict:
    from models.record_statuses          import RecordStatus
    from models.record_version_tags      import RecordVersionTag
    from models.record_version_participant import RecordVersionParticipant
    from models.tags                     import Tag

    query = (
        db.query(Record)
        .filter(Record.deleted_at.is_(None))
    )

    if status_filter:
        status_row = db.query(RecordStatus).filter_by(code=status_filter).first()
        if status_row:
            query = query.filter(Record.status_id == status_row.id)

    if client_id:
        query = query.filter(Record.client_id == client_id)

    if project_id:
        query = query.filter(Record.project_id == project_id)

    total   = query.count()
    records = query.order_by(Record.created_at.desc()).offset(skip).limit(limit).all()

    items = []
    for rec in records:
        # Status code
        status_row  = db.query(RecordStatus).filter_by(id=rec.status_id).first()
        status_code = status_row.code if status_row else "unknown"

        # Client / project names
        client_name  = getattr(getattr(rec, "client",  None), "name", None)
        project_name = getattr(getattr(rec, "project", None), "name", None)

        # Fecha y hora formateadas
        date_str = None
        time_str = None
        if rec.document_date:
            from datetime import date as date_type
            d = rec.document_date
            MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
            date_str = f"{d.day} {MONTHS[d.month - 1]} {d.year}"
        if rec.scheduled_start_time:
            t = rec.scheduled_start_time
            hour = t.hour
            suffix = "AM" if hour < 12 else "PM"
            hour12 = hour % 12 or 12
            time_str = f"{hour12}:{t.minute:02d} {suffix}"

        # Participantes desde la versión activa
        participant_names: list[str] = []
        if rec.active_version_id:
            participants = (
                db.query(RecordVersionParticipant)
                .filter_by(record_version_id=rec.active_version_id)
                .order_by(RecordVersionParticipant.id)
                .all()
            )
            names = [p.display_name for p in participants]
            participant_names = names

        # Tags desde la versión activa
        # Tags: user tags primero, AI tags como fallback
        tag_items: list[dict] = []
        if rec.active_version_id:
            rvt_rows = db.query(RecordVersionTag).filter_by(
                record_version_id=rec.active_version_id
            ).all()
            for rvt in rvt_rows:
                tag = db.query(Tag).filter_by(id=rvt.tag_id).first()
                if tag:
                    tag_items.append({"label": tag.name, "color": _tag_color(tag.category_id)})

            if not tag_items:
                from models.record_version_ai_tags import RecordVersionAiTag
                from models.ai_tags import AITag
                ai_rvt = db.query(RecordVersionAiTag).filter_by(
                    record_version_id=rec.active_version_id
                ).limit(5).all()
                for rvt in ai_rvt:
                    ai_tag = db.query(AITag).filter_by(id=rvt.ai_tag_id).first()
                    if ai_tag:
                        tag_items.append({"label": ai_tag.slug, "color": _tag_color(ai_tag.id)})

        # Summary desde intro_snippet o summary_text de la versión
        summary = rec.intro_snippet
        if not summary and rec.active_version_id:
            from models.record_versions import RecordVersion as RV
            version = db.query(RV).filter_by(id=rec.active_version_id).first()
            if version:
                summary = version.summary_text

        items.append({
            "id":           rec.id,
            "title":        rec.title,
            "date":         date_str,
            "time":         time_str,
            "status":       status_code,
            "client":       client_name,
            "project":      project_name,
            "participants": participant_names,
            "summary":      summary,
            "tags":         tag_items,
        })

    return {"minutes": items, "total": total, "skip": skip, "limit": limit}
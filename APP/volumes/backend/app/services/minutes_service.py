# services/minutes_service.py
from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

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

_STATUSES_NO_CONTENT = {RECORD_STATUS_LLM_FAILED, RECORD_STATUS_PROC_ERROR, "in-progress"}

_VALID_TRANSITIONS: dict[str, set[str]] = {
    RECORD_STATUS_READY:      {RECORD_STATUS_PENDING, RECORD_STATUS_DELETED},
    RECORD_STATUS_PENDING:    {RECORD_STATUS_PREVIEW, RECORD_STATUS_CANCELLED, RECORD_STATUS_DELETED},
    RECORD_STATUS_PREVIEW:    {RECORD_STATUS_PENDING, RECORD_STATUS_COMPLETED, RECORD_STATUS_CANCELLED, RECORD_STATUS_DELETED},
    RECORD_STATUS_CANCELLED:  {RECORD_STATUS_DELETED},
    RECORD_STATUS_LLM_FAILED: {RECORD_STATUS_DELETED},
    RECORD_STATUS_PROC_ERROR: {RECORD_STATUS_DELETED},
    RECORD_STATUS_COMPLETED:  set(),
    RECORD_STATUS_DELETED:    set(),
}

QUEUE_PDF    = "queue:pdf"
QUEUE_MINUTES = "queue:minutes"

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
    "text/plain":               "text/plain",
    "text/plain; charset=utf8": "text/plain",
    "text/plain;charset=utf-8": "text/plain",
    "text/plain;charset=utf8":  "text/plain",
    "application/json":         "application/json",
    "application/pdf":          "application/pdf",
    "image/png":                "image/png",
    "image/jpeg":               "image/jpeg",
    "image/jpg":                "image/jpeg",
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


def _resolve_record_status_code(db: Session, record: Record) -> str:
    from models.record_statuses import RecordStatus
    row = db.query(RecordStatus).filter_by(id=record.status_id).first()
    return row.code if row else "unknown"


def _calculate_prompt_sha() -> str:
    try:
        p = PROMPT_PATH_BASE / PROMPT_FILE
        if not p.exists():
            return f"file_not_found_{PROMPT_FILE}"
        with open(p, "rb") as f:
            return _sha256_bytes(f.read())
    except Exception:
        return f"error_calculating_sha"


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
    raw = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    minio.put_object(
        bucket_name=bucket, object_name=object_key,
        data=io.BytesIO(raw), length=len(raw), content_type="application/json",
    )
    return len(raw)


# ─── Helper Redis: encolar jobs ───────────────────────────────────────────────

async def _enqueue_job(queue: str, job: dict) -> None:
    from db.redis import get_redis
    redis = get_redis()
    await redis.rpush(queue, json.dumps(job))
    logger.info(f"[minutes] Job encolado | queue={queue} type={job.get('type')}")


# ─── generate_minute (TX1 + enqueue) ─────────────────────────────────────────

async def generate_minute(
    db:              Session,
    request:         MinuteGenerateRequest,
    files:           list[UploadFile],
    requested_by_id: str,
) -> MinuteGenerateResponse:
    """
    TX1: crea Record + MinuteTransaction + sube archivos a MinIO.
    Encola el job al worker para que ejecute TX2 (OpenAI + artefactos + versión).
    Retorna 202 inmediatamente con transaction_id para que el frontend escuche SSE.
    """
    from models.artifact_types   import ArtifactType
    from models.buckets          import Bucket
    from models.record_statuses  import RecordStatus
    from models.record_types     import RecordType

    transaction_id = str(uuid.uuid4())
    record_id      = str(uuid.uuid4())
    now            = _now_utc()
    file_metadata:     list[dict] = []
    input_objects_meta: list[dict] = []

    logger.info(f"[minutes] TX1 iniciando | record={record_id} tx={transaction_id}")

    # ── Resolver IDs de catálogo ──────────────────────────────────────────────
    record_type_id   = _get_catalog_id(db, RecordType,   RECORD_TYPE_MINUTE)
    record_status_id = _get_catalog_id(db, RecordStatus, RECORD_STATUS_IN_PROGRESS)
    bucket_inputs_id = _get_catalog_id(db, Bucket,       BUCKET_CODE_INPUTS)
    bucket_json_id   = _get_catalog_id(db, Bucket,       BUCKET_CODE_JSON)
    art_transcript_id = _get_catalog_id(db, ArtifactType, ART_INPUT_TRANSCRIPT)
    art_summary_id    = _get_catalog_id(db, ArtifactType, ART_INPUT_SUMMARY)

    from models.artifact_states  import ArtifactState
    from models.version_statuses import VersionStatus
    art_llm_orig_id   = _get_catalog_id(db, ArtifactType,  ART_LLM_JSON_ORIG)
    art_canonical_id  = _get_catalog_id(db, ArtifactType,  ART_CANONICAL_JSON)
    state_original_id = _get_catalog_id(db, ArtifactState, ART_STATE_ORIGINAL)
    state_ready_id    = _get_catalog_id(db, ArtifactState, ART_STATE_READY)
    version_status_id = _get_catalog_id(db, VersionStatus, VERSION_STATUS_SNAPSHOT)

    profile_data = _get_ai_profile_data(db, request.profile_info.profile_id)
    ai_profile_id = request.profile_info.profile_id
    client_id  = getattr(request.project_info, "client_id",  None) or None
    project_id = getattr(request.project_info, "project_id", None) or None

    if not client_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "missing_client", "message": "Se requiere un cliente (clientID)"})

    record_title = (
        request.meeting_info.title
        or f"Reunión {request.project_info.client} – {request.meeting_info.scheduled_date}"
    )

    # ── Crear Record ──────────────────────────────────────────────────────────
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

    # ── Crear MinuteTransaction ───────────────────────────────────────────────
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

    # ── Subir archivos a MinIO ────────────────────────────────────────────────
    minio           = get_minio_client()
    input_object_id: Optional[str] = None

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
        db.add(_build_object_row(obj_id, bucket_inputs_id, obj_key, mime, ext, len(raw), sha, requested_by_id))

        input_objects_meta.append({"obj_id": obj_id, "art_type_id": art_type_id, "fname": fname})
        file_metadata.append({"fileName": fname, "mimeType": mime, "sha256": sha, "fileType": file_type})
        if input_object_id is None:
            input_object_id = obj_id

    tx.status          = "pending"
    tx.input_object_id = input_object_id
    tx.openai_model    = settings.openai_model

    # ── TX1 COMMIT ────────────────────────────────────────────────────────────
    try:
        db.commit()
        logger.info(f"[minutes] TX1 OK | record={record_id} archivos={len(file_metadata)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "tx1_commit_error", "message": "Error al persistir el intake."})

    # ── Encolar job al worker ─────────────────────────────────────────────────
    ai_input_schema = _build_ai_input_schema(request, transaction_id, file_metadata)

    job_envelope = {
        "job_id":    str(uuid.uuid4()),
        "type":      "minutes",
        "queue":     QUEUE_MINUTES,
        "attempt":   1,
        "payload": {
            "transaction_id":     transaction_id,
            "record_id":          record_id,
            "requested_by_id":    requested_by_id,
            "ai_profile":         profile_data,
            "ai_input_schema":    ai_input_schema,
            "file_metadata":      file_metadata,
            "input_objects_meta": input_objects_meta,
            "catalog_ids": {
                "version_status_id": version_status_id,
                "bucket_json_id":    bucket_json_id,
                "art_llm_orig_id":   art_llm_orig_id,
                "art_canonical_id":  art_canonical_id,
                "state_original_id": state_original_id,
                "state_ready_id":    state_ready_id,
            },
        },
    }

    try:
        await _enqueue_job(QUEUE_MINUTES, job_envelope)
        logger.info(f"[minutes] Job encolado | tx={transaction_id}")
    except Exception as e:
        # El job no se pudo encolar — marcar la tx como failed sin perder el record
        logger.error(f"[minutes] Error encolando job | tx={transaction_id}: {e}", exc_info=True)
        try:
            tx = db.merge(tx)
            tx.status        = "failed"
            tx.error_message = f"Error al encolar job: {e}"
            db.commit()
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "queue_error", "message": "Error interno al encolar la tarea."})

    return MinuteGenerateResponse(
        transaction_id=transaction_id,
        record_id=record_id,
        status="pending",
        message="Solicitud recibida. La minuta se está generando.",
    )


# ─── get_minute_status ────────────────────────────────────────────────────────

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


# ─── get_minute_detail ────────────────────────────────────────────────────────

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
            content = _read_json_from_minio(minio, BUCKET_JSON, f"{record_id}/schema_output_v1.json")
    elif status_code in (RECORD_STATUS_PREVIEW, RECORD_STATUS_COMPLETED):
        content = _read_json_from_minio(minio, BUCKET_JSON, f"{record_id}/schema_output_v{version_num}.json")

    return MinuteDetailResponse(record=record_info, content=content)


# ─── save_minute_draft ────────────────────────────────────────────────────────

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
                    "message": f"Autosave solo disponible en estado 'pending'. Estado actual: '{status_code}'."})

    try:
        draft_bytes = json.dumps(content, ensure_ascii=False, indent=2).encode("utf-8")
        minio = get_minio_client()
        minio.put_object(bucket_name=BUCKET_DRAFT, object_name=f"{record_id}/draft_current.json",
                         data=io.BytesIO(draft_bytes), length=len(draft_bytes), content_type="application/json")
    except Exception as e:
        raise HTTPException(status_code=500,
            detail={"error": "minio_write_error", "message": "Error al guardar el borrador."})


# ─── transition_minute ────────────────────────────────────────────────────────

async def transition_minute(
    db:             Session,
    record_id:      str,
    target_status:  str,
    commit_message: Optional[str],
    actor_user_id:  str,
) -> MinuteTransitionResponse:
    from models.record_statuses  import RecordStatus
    from models.version_statuses import VersionStatus
    from models.buckets          import Bucket
    from models.record_drafts    import RecordDraft

    record = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if record is None:
        raise HTTPException(status_code=404,
            detail={"error": "record_not_found", "message": f"Minuta '{record_id}' no encontrada."})

    current_status_row  = db.query(RecordStatus).filter_by(id=record.status_id).first()
    current_status_code = current_status_row.code if current_status_row else "unknown"

    allowed = _VALID_TRANSITIONS.get(current_status_code, set())
    if target_status not in allowed:
        raise HTTPException(status_code=409,
            detail={"error": "invalid_transition",
                    "message": f"No se puede transicionar de '{current_status_code}' a '{target_status}'. "
                               f"Válidas: {sorted(allowed) or 'ninguna (estado terminal)'}."})

    target_status_id   = _get_catalog_id(db, RecordStatus,  target_status)
    snapshot_status_id = _get_catalog_id(db, VersionStatus, VERSION_STATUS_SNAPSHOT)
    final_status_id    = _get_catalog_id(db, VersionStatus, VERSION_STATUS_FINAL)
    bucket_json_id     = _get_catalog_id(db, Bucket,        BUCKET_CODE_JSON)

    minio       = get_minio_client()
    new_version: Optional[RecordVersion] = None

    # ── ready-for-edit → pending ──────────────────────────────────────────────
    if current_status_code == RECORD_STATUS_READY and target_status == RECORD_STATUS_PENDING:
        content = _read_json_from_minio(minio, BUCKET_JSON, f"{record_id}/schema_output_v1.json")
        if content is None:
            raise HTTPException(status_code=500,
                detail={"error": "content_not_found", "message": "No se encontró el contenido base."})

        _write_json_to_minio(minio, BUCKET_DRAFT, f"{record_id}/draft_current.json", content)

        new_version_num = int(record.latest_version_num) + 1
        new_version_id  = str(uuid.uuid4())
        new_version = RecordVersion(
            id=new_version_id, record_id=record_id, version_num=new_version_num,
            status_id=snapshot_status_id, published_by=actor_user_id,
            schema_version="1.0", template_version="1.0",
        )
        db.add(new_version)
        db.flush()
        record.active_version_id  = new_version_id
        record.latest_version_num = new_version_num

    # ── pending → preview ─────────────────────────────────────────────────────
    elif current_status_code == RECORD_STATUS_PENDING and target_status == RECORD_STATUS_PREVIEW:
        draft_content = _read_json_from_minio(minio, BUCKET_DRAFT, f"{record_id}/draft_current.json")
        if draft_content is None:
            raise HTTPException(status_code=500,
                detail={"error": "draft_not_found", "message": "No se encontró el draft activo."})

        new_version_num = int(record.latest_version_num) + 1
        snapshot_key    = f"{record_id}/schema_output_v{new_version_num}.json"
        snap_size       = _write_json_to_minio(minio, BUCKET_JSON, snapshot_key, draft_content)

        snap_obj_id = str(uuid.uuid4())
        snap_sha    = _sha256_bytes(json.dumps(draft_content, ensure_ascii=False, indent=2).encode("utf-8"))
        db.add(_build_object_row(snap_obj_id, bucket_json_id, snapshot_key,
                                  "application/json", "json", snap_size, snap_sha, actor_user_id))
        db.flush()

        new_version_id = str(uuid.uuid4())
        new_version = RecordVersion(
            id=new_version_id, record_id=record_id, version_num=new_version_num,
            status_id=snapshot_status_id, published_by=actor_user_id,
            schema_version="1.0", template_version="1.0",
        )
        db.add(new_version)
        db.flush()
        record.active_version_id  = new_version_id
        record.latest_version_num = new_version_num

        try:
            await _enqueue_job(QUEUE_PDF, {
                "type": "generate_draft_pdf", "record_id": record_id,
                "version_num": new_version_num, "watermark": "BORRADOR",
            })
        except Exception as e:
            logger.warning(f"[minutes] No se pudo encolar PDF borrador | record={record_id}: {e}")

    # ── preview → completed ───────────────────────────────────────────────────
    elif current_status_code == RECORD_STATUS_PREVIEW and target_status == RECORD_STATUS_COMPLETED:
        active_version = db.query(RecordVersion).filter_by(id=record.active_version_id).first()
        if active_version:
            active_version.status_id = final_status_id

        try:
            await _enqueue_job(QUEUE_PDF, {
                "type": "generate_final_pdf", "record_id": record_id,
                "version_num": int(record.latest_version_num),
            })
        except Exception as e:
            logger.warning(f"[minutes] No se pudo encolar PDF final | record={record_id}: {e}")

    # ── * → deleted ───────────────────────────────────────────────────────────
    elif target_status == RECORD_STATUS_DELETED:
        record.deleted_at = _now_utc()

    # preview → pending y * → cancelled: solo cambia el status

    record.status_id  = target_status_id
    record.updated_by = actor_user_id
    db.commit()

    logger.info(f"[minutes] Transición | record={record_id} {current_status_code} → {target_status}")

    return MinuteTransitionResponse(
        record_id   = record_id,
        status      = target_status,
        version_num = int(new_version.version_num) if new_version else None,
        version_id  = new_version.id if new_version else None,
        message     = f"Transición '{current_status_code}' → '{target_status}' completada.",
    )


# ─── list_minutes ─────────────────────────────────────────────────────────────

_TAG_COLORS = [
    "#FF1744","#F50057","#C51162","#FF4081","#E91E63","#FF9100","#FF6D00","#FF3D00",
    "#FFAB00","#FFC400","#FFEA00","#C6FF00","#76FF03","#64DD17","#00E676","#00C853",
    "#69F0AE","#1DE9B6","#00BFA5","#00E5FF","#00B0FF","#2979FF","#304FFE","#3D5AFE",
    "#AA00FF","#D500F9","#E040FB","#7C4DFF","#651FFF","#C2185B","#AD1457","#6A1B9A",
]

def _tag_color(category_id) -> str:
    idx = int(hashlib.md5(str(category_id).encode()).hexdigest(), 16) % len(_TAG_COLORS)
    return _TAG_COLORS[idx]


def list_minutes(
    db:            Session,
    skip:          int = 0,
    limit:         int = 50,
    status_filter: Optional[str] = None,
    client_id:     Optional[str] = None,
    project_id:    Optional[str] = None,
) -> dict:
    from models.record_statuses            import RecordStatus
    from models.record_version_tags        import RecordVersionTag
    from models.record_version_participant import RecordVersionParticipant
    from models.tags                       import Tag

    query = db.query(Record).filter(Record.deleted_at.is_(None))

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
        status_row  = db.query(RecordStatus).filter_by(id=rec.status_id).first()
        status_code = status_row.code if status_row else "unknown"
        client_name  = getattr(getattr(rec, "client",  None), "name", None)
        project_name = getattr(getattr(rec, "project", None), "name", None)

        date_str = None
        if rec.document_date:
            d = rec.document_date
            MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
            date_str = f"{d.day} {MONTHS[d.month - 1]} {d.year}"

        time_str = None
        if rec.scheduled_start_time:
            t = rec.scheduled_start_time
            h12 = t.hour % 12 or 12
            time_str = f"{h12}:{t.minute:02d} {'AM' if t.hour < 12 else 'PM'}"

        participant_names: list[str] = []
        if rec.active_version_id:
            rows = (db.query(RecordVersionParticipant)
                    .filter_by(record_version_id=rec.active_version_id)
                    .order_by(RecordVersionParticipant.id).all())
            participant_names = [p.display_name for p in rows]

        tag_items: list[dict] = []
        if rec.active_version_id:
            rvt_rows = db.query(RecordVersionTag).filter_by(record_version_id=rec.active_version_id).all()
            for rvt in rvt_rows:
                tag = db.query(Tag).filter_by(id=rvt.tag_id).first()
                if tag:
                    tag_items.append({"label": tag.name, "color": _tag_color(tag.category_id)})
            if not tag_items:
                from models.record_version_ai_tags import RecordVersionAiTag
                from models.ai_tags                import AITag
                ai_rvt = db.query(RecordVersionAiTag).filter_by(record_version_id=rec.active_version_id).limit(5).all()
                for rvt in ai_rvt:
                    ai_tag = db.query(AITag).filter_by(id=rvt.ai_tag_id).first()
                    if ai_tag:
                        tag_items.append({"label": ai_tag.slug, "color": _tag_color(ai_tag.id)})

        summary = rec.intro_snippet
        if not summary and rec.active_version_id:
            rv = db.query(RecordVersion).filter_by(id=rec.active_version_id).first()
            if rv:
                summary = getattr(rv, "summary_text", None)

        items.append({
            "id": rec.id, "title": rec.title, "date": date_str, "time": time_str,
            "status": status_code, "client": client_name, "project": project_name,
            "participants": participant_names, "summary": summary, "tags": tag_items,
        })

    return {"minutes": items, "total": total, "skip": skip, "limit": limit}
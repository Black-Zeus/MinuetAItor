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
from models.ai_profiles import AiProfile

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

QUEUE_PDF = "queue:pdf"

# Estados que no tienen contenido disponible para el editor
_STATUSES_NO_CONTENT = {
    RECORD_STATUS_LLM_FAILED,
    RECORD_STATUS_PROC_ERROR,
    RECORD_STATUS_IN_PROGRESS,
}

# Matriz de transiciones válidas
# Fuente: seeds record_statuses + lógica de negocio
_VALID_TRANSITIONS: dict[str, set[str]] = {
    RECORD_STATUS_IN_PROGRESS: {RECORD_STATUS_CANCELLED},
    RECORD_STATUS_READY:       {RECORD_STATUS_PENDING, RECORD_STATUS_CANCELLED, RECORD_STATUS_DELETED},
    RECORD_STATUS_PENDING:     {RECORD_STATUS_PREVIEW, RECORD_STATUS_CANCELLED, RECORD_STATUS_DELETED},
    RECORD_STATUS_PREVIEW:     {RECORD_STATUS_PENDING, RECORD_STATUS_COMPLETED, RECORD_STATUS_CANCELLED, RECORD_STATUS_DELETED},
    RECORD_STATUS_CANCELLED:   {RECORD_STATUS_DELETED},
    RECORD_STATUS_LLM_FAILED:  {RECORD_STATUS_DELETED},
    RECORD_STATUS_PROC_ERROR:  {RECORD_STATUS_DELETED},
    RECORD_STATUS_COMPLETED:   set(),   # terminal
    RECORD_STATUS_DELETED:     set(),   # terminal
}

PROMPT_FILE = getattr(settings, "prompt_file", "system_prompt_v02.txt")


# ─── Helpers de catálogo ──────────────────────────────────────────────────────

def _get_catalog_id(db: Session, model, code: str):
    obj = db.query(model).filter_by(code=code).first()
    if not obj:
        raise RuntimeError(
            f"Catálogo '{model.__tablename__}' con code='{code}' no encontrado. "
            "Verifica los seeds."
        )
    return obj.id


def _calculate_prompt_sha() -> str:
    try:
        prompt_path = Path(settings.prompt_path_base) / PROMPT_FILE
        return hashlib.sha256(prompt_path.read_bytes()).hexdigest()
    except Exception:
        return "unavailable"


def _build_object_row(obj_id, bucket_id, key, content_type, ext, size, sha, by_id):
    return Object(
        id=obj_id, bucket_id=bucket_id, object_key=key,
        content_type=content_type, file_ext=ext,
        size_bytes=size, sha256=sha, created_by=by_id,
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


# ─── Helper: construir schema de input para el worker ────────────────────────

def _build_input_schema(request: MinuteGenerateRequest) -> dict:
    mi = request.meeting_info
    pi = request.project_info
    pa = request.participants
    pr = request.profile_info

    schema: dict = {
        "meetingInfo": {
            "scheduledDate":      mi.scheduled_date,
            "scheduledStartTime": mi.scheduled_start_time,
            "scheduledEndTime":   mi.scheduled_end_time,
        },
        "projectInfo": {
            "client":    pi.client,
            "clientId":  pi.client_id,
            "project":   pi.project,
            "projectId": pi.project_id,
        },
        "declaredParticipants": {
            "attendees": pa.attendees,
        },
        "profileInfo": {"profileId": pr.profile_id, "profileName": pr.profile_name},
        "preparedBy":  request.prepared_by,
        "systemPrompt": {"name": PROMPT_FILE, "signedSha": _calculate_prompt_sha()},
    }
    if mi.actual_start_time: schema["meetingInfo"]["actualStartTime"] = mi.actual_start_time
    if mi.actual_end_time:   schema["meetingInfo"]["actualEndTime"]   = mi.actual_end_time
    if mi.location:          schema["meetingInfo"]["location"]        = mi.location
    if mi.title:             schema["meetingInfo"]["title"]           = mi.title
    if pi.category:          schema["projectInfo"]["category"]        = pi.category
    if pa.invited:           schema["declaredParticipants"]["invited"] = pa.invited
    if pa.copy_recipients:   schema["declaredParticipants"]["copyRecipients"] = pa.copy_recipients
    if request.additional_notes:   schema["additionalNotes"]   = request.additional_notes
    if request.generation_options: schema["generationOptions"] = {"language": request.generation_options.language}
    return schema


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
    Retorna 202 inmediatamente con transaction_id.
    """
    from models.buckets          import Bucket
    from models.artifact_types   import ArtifactType
    from models.artifact_states  import ArtifactState
    from models.record_statuses  import RecordStatus
    from models.record_types     import RecordType
    from models.record_drafts    import RecordDraft

    minio = get_minio_client()

    # ── Catálogos ─────────────────────────────────────────────────────────────
    bucket_inputs_id    = _get_catalog_id(db, Bucket,       BUCKET_CODE_INPUTS)
    art_transcript_id   = _get_catalog_id(db, ArtifactType, ART_INPUT_TRANSCRIPT)
    art_summary_id      = _get_catalog_id(db, ArtifactType, ART_INPUT_SUMMARY)
    art_state_ready_id  = _get_catalog_id(db, ArtifactState, ART_STATE_READY)
    status_in_prog_id   = _get_catalog_id(db, RecordStatus,  RECORD_STATUS_IN_PROGRESS)
    record_type_id      = _get_catalog_id(db, RecordType,    RECORD_TYPE_MINUTE)

    # ── IDs ───────────────────────────────────────────────────────────────────
    record_id      = str(uuid.uuid4())
    transaction_id = str(uuid.uuid4())

    # ── Subir archivos a MinIO ────────────────────────────────────────────────
    input_objects_meta = []
    for f in files:
        raw       = await f.read()
        obj_key   = f"{record_id}/inputs/{f.filename}"
        obj_id    = str(uuid.uuid4())
        sha       = hashlib.sha256(raw).hexdigest()
        mime      = f.content_type or "application/octet-stream"
        ext       = Path(f.filename).suffix.lstrip(".") if f.filename else ""

        minio.put_object(
            bucket_name=BUCKET_INPUTS, object_name=obj_key,
            data=io.BytesIO(raw), length=len(raw), content_type=mime,
        )

        is_transcript = any(kw in f.filename.lower() for kw in ["transcript", "transcripcion", "transcripción"]) \
                        if f.filename else False
        art_type_id = art_transcript_id if is_transcript else art_summary_id

        db.add(_build_object_row(obj_id, bucket_inputs_id, obj_key, mime, ext, len(raw), sha, requested_by_id))

        input_objects_meta.append({
            "obj_id":      obj_id,
            "obj_key":     obj_key,
            "sha256":      sha,
            "size_bytes":  len(raw),
            "mime":        mime,
            "art_type_id": art_type_id,
            "art_state_id": art_state_ready_id,
            "filename":    f.filename,
        })

    # ── Record ────────────────────────────────────────────────────────────────
    mi = request.meeting_info
    pi = request.project_info

    record = Record(
        id=record_id,
        record_type_id=record_type_id,
        status_id=status_in_prog_id,
        title=mi.title or f"{pi.client} — {mi.scheduled_date}",
        client_id=pi.client_id,
        project_id=pi.project_id,
        document_date=mi.scheduled_date,
        location=mi.location,
        prepared_by_user_id=requested_by_id,
        latest_version_num=0,
        created_by=requested_by_id,
    )
    db.add(record)

    # ── MinuteTransaction ─────────────────────────────────────────────────────
    input_schema = _build_input_schema(request)
    input_bytes  = json.dumps(input_schema, ensure_ascii=False, indent=2).encode("utf-8")

    tx = MinuteTransaction(
        id=transaction_id,
        record_id=record_id,
        status="processing",
        requested_by=requested_by_id,
    )
    db.add(tx)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        logger.error(f"[minutes] TX1 IntegrityError: {e}")
        raise HTTPException(status_code=500, detail="Error al crear el registro de minuta.")

    # ── Encolar job al worker ─────────────────────────────────────────────────
    ai_profile_obj = db.query(AiProfile).filter(
        AiProfile.id == request.profile_info.profile_id
    ).first()

    job_payload = {
        "type":            "generate_minute",
        "transaction_id":  transaction_id,
        "record_id":       record_id,
        "requested_by_id": requested_by_id,

        # Clave que el worker llama "ai_input_schema" (el backend la llama "input_schema")
        "ai_input_schema": input_schema,

        # Clave que el worker usa para descargar archivos de MinIO
        # El worker espera: [{ fileName, mimeType, sha256, fileType }]
        # obj_key tiene la forma "{record_id}/inputs/{filename}" — el worker usa solo el filename
        "file_metadata": [
            {
                "fileName": m["filename"],
                "mimeType": m["mime"],
                "sha256":   m["sha256"],
                "fileType": "transcript" if m["art_type_id"] == art_transcript_id else "summary",
                "objKey":   m["obj_key"],
            }
            for m in input_objects_meta
        ],

        # Para el commit_tx2 al final del worker
        "input_objects_meta": input_objects_meta,

        # Perfil IA con los 4 campos que el worker necesita
        "ai_profile": {
            "profile_id":          str(ai_profile_obj.id)              if ai_profile_obj else request.profile_info.profile_id,
            "profile_name":        ai_profile_obj.name                 if ai_profile_obj else request.profile_info.profile_name,
            "profile_description": ai_profile_obj.description or ""    if ai_profile_obj else "",
            "profile_prompt":      ai_profile_obj.prompt      or ""    if ai_profile_obj else "",
        },

        # catalog_ids — el worker lo usa con .get() así que puede ir vacío por ahora
        "catalog_ids": {},
    }
    
    try:
        await _enqueue_job("queue:minutes", job_payload)
    except Exception as e:
        logger.error(f"[minutes] No se pudo encolar el job: {e}")
        # TX1 ya está committed — el job puede reencolar manualmente desde DLQ

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
    """
    Carga la minuta con su contenido embebido y el content_type correcto
    para que el frontend sepa qué mapper aplicar.

    Reglas de content_type:
      ready-for-edit → "ai_output"  (schema_output_v1.json, formato IA, inmutable)
      pending        → "draft"      (draft_current.json, formato editor)
      preview        → "snapshot"   (schema_output_vN.json, formato editor)
      completed      → "snapshot"   (schema_output_vN.json, formato editor)
      otros          → None         (sin contenido)
    """
    from models.record_statuses import RecordStatus

    record = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if record is None:
        raise HTTPException(status_code=404,
            detail={"error": "record_not_found", "message": f"Minuta '{record_id}' no encontrada."})

    status_row  = db.query(RecordStatus).filter_by(id=record.status_id).first()
    status_code = status_row.code if status_row else "unknown"

    client_name      = getattr(getattr(record, "client",  None), "name", None)
    project_name     = getattr(getattr(record, "project", None), "name", None)
    prepared_by_name = None
    prep_user = getattr(record, "prepared_by_user", None)
    if prep_user:
        profile          = getattr(prep_user, "profile", None)
        prepared_by_name = getattr(profile, "full_name", None) or getattr(prep_user, "username", None)

    record_info = MinuteRecordInfo(
        id=record.id, status=status_code, title=record.title,
        client_id=str(record.client_id)       if record.client_id       else None,
        client_name=client_name,
        project_id=str(record.project_id)     if record.project_id      else None,
        project_name=project_name,
        active_version_id=str(record.active_version_id) if record.active_version_id else None,
        active_version_num=int(record.latest_version_num) if record.latest_version_num else None,
        document_date=record.document_date.isoformat() if record.document_date else None,
        location=record.location,
        prepared_by=prepared_by_name,
        created_at=record.created_at.isoformat() if getattr(record, "created_at", None) else None,
    )

    # Estados sin contenido
    if status_code in _STATUSES_NO_CONTENT:
        return MinuteDetailResponse(record=record_info, content=None, content_type=None)

    minio       = get_minio_client()
    content     = None
    content_type: Optional[str] = None
    version_num = int(record.latest_version_num) if record.latest_version_num else 1

    if status_code == RECORD_STATUS_READY:
        # JSON original de la IA — inmutable, usa mapIAResponseToEditorState en el frontend
        content      = _read_json_from_minio(minio, BUCKET_JSON, f"{record_id}/schema_output_v1.json")
        content_type = "ai_output"

    elif status_code == RECORD_STATUS_PENDING:
        # Draft en edición activa.
        # Intenta draft_current.json (formato editor, post-primer autosave).
        # Si no existe todavía (recién entró a pending), carga el schema_output_v1.json
        # y fuerza content_type="ai_output" para que el frontend use el mapper correcto.
        content = _read_json_from_minio(minio, BUCKET_DRAFT, f"{record_id}/draft_current.json")
        if content is not None:
            content_type = "draft"
        else:
            # Primera apertura del editor antes del primer autosave:
            # el draft aún no existe, se carga el JSON de la IA como punto de partida.
            content      = _read_json_from_minio(minio, BUCKET_JSON, f"{record_id}/schema_output_v1.json")
            content_type = "ai_output"
            logger.info(f"[minutes] draft_current.json no encontrado para {record_id}, cargando ai_output como fallback")

    elif status_code in (RECORD_STATUS_PREVIEW, RECORD_STATUS_COMPLETED):
        # Snapshot publicado — mismo formato que el draft (formato editor)
        content      = _read_json_from_minio(minio, BUCKET_JSON, f"{record_id}/schema_output_v{version_num}.json")
        content_type = "snapshot"

    return MinuteDetailResponse(record=record_info, content=content, content_type=content_type)


# ─── save_minute_draft ────────────────────────────────────────────────────────

async def save_minute_draft(db: Session, record_id: str, content: dict) -> None:
    """
    Autosave del editor. Solo disponible en estado 'pending'.
    El content recibido es el payload en formato editor (getExportPayload del store).
    Se persiste en minuetaitor-draft/{record_id}/draft_current.json.
    Tras el guardado, encola un job PDF (best-effort) para mantener el PDF actualizado.
    """
    from models.record_statuses import RecordStatus
    from sqlalchemy.orm import joinedload

    record = (
        db.query(Record)
        .options(
            joinedload(Record.project).joinedload("client"),
            joinedload(Record.created_by_user),
        )
        .filter(Record.id == record_id, Record.deleted_at.is_(None))
        .first()
    )
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
        minio.put_object(
            bucket_name=BUCKET_DRAFT, object_name=f"{record_id}/draft_current.json",
            data=io.BytesIO(draft_bytes), length=len(draft_bytes), content_type="application/json",
        )
        logger.debug(f"[minutes] Autosave OK | record={record_id} bytes={len(draft_bytes)}")
    except Exception as e:
        logger.error(f"[minutes] Autosave MinIO error | record={record_id}: {e}")
        raise HTTPException(status_code=500,
            detail={"error": "minio_write_error", "message": "Error al guardar el borrador."})

    # Encolar PDF de borrador — best-effort, no bloquea el autosave si falla
    try:
        from services.pdf_job_builder import build_pdf_job_on_save
        envelope = build_pdf_job_on_save(record=record, draft_content=content)
        await _enqueue_job(QUEUE_PDF, envelope)
        logger.debug(f"[minutes] PDF borrador encolado tras save | record={record_id}")
    except Exception as e:
        logger.warning(f"[minutes] No se pudo encolar PDF en save | record={record_id}: {e}")


# ─── transition_minute ────────────────────────────────────────────────────────

async def transition_minute(
    db:             Session,
    record_id:      str,
    target_status:  str,
    commit_message: Optional[str],
    actor_user_id:  str,
) -> MinuteTransitionResponse:
    """
    Gestiona todas las transiciones de estado del ciclo de vida de una minuta.

    Transiciones con lógica de datos:
      ready-for-edit → pending:
        Copia schema_output_v1.json a draft_current.json.
        Crea nueva RecordVersion (snapshot).

      pending → preview:
        Lee draft_current.json (formato editor).
        Lo persiste como schema_output_vN.json (snapshot inmutable).
        Encola job PDF con watermark="BORRADOR".

      preview → completed:
        Marca RecordVersion como "final".
        Encola job PDF sin watermark (versión publicada).

      preview → pending:
        Solo cambia el estado; el draft_current.json sigue disponible para edición.

      * → cancelled, * → deleted:
        Solo actualiza el estado del Record.
    """
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
        # Copia el JSON de la IA como punto de partida del draft.
        # Nota: el draft aún está en formato IA. El primer autosave lo convertirá
        # al formato editor. El frontend sabe distinguir por content_type.
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
            summary_text=commit_message,
        )
        db.add(new_version)
        db.flush()
        record.active_version_id  = new_version_id
        record.latest_version_num = new_version_num

    # ── pending → preview ─────────────────────────────────────────────────────
    elif current_status_code == RECORD_STATUS_PENDING and target_status == RECORD_STATUS_PREVIEW:
        # Lee el draft en formato editor y lo congela como snapshot versionado.
        draft_content = _read_json_from_minio(minio, BUCKET_DRAFT, f"{record_id}/draft_current.json")
        if draft_content is None:
            raise HTTPException(status_code=500,
                detail={"error": "draft_not_found", "message": "No se encontró el draft activo."})

        new_version_num = int(record.latest_version_num) + 1
        snapshot_key    = f"{record_id}/schema_output_v{new_version_num}.json"
        snap_size       = _write_json_to_minio(minio, BUCKET_JSON, snapshot_key, draft_content)

        snap_obj_id = str(uuid.uuid4())
        snap_sha    = hashlib.sha256(
            json.dumps(draft_content, ensure_ascii=False, indent=2).encode("utf-8")
        ).hexdigest()
        db.add(_build_object_row(
            snap_obj_id, bucket_json_id, snapshot_key,
            "application/json", "json", snap_size, snap_sha, actor_user_id,
        ))
        db.flush()

        new_version_id = str(uuid.uuid4())
        new_version = RecordVersion(
            id=new_version_id, record_id=record_id, version_num=new_version_num,
            status_id=snapshot_status_id, published_by=actor_user_id,
            schema_version="1.0", template_version="1.0",
            summary_text=commit_message,
        )
        db.add(new_version)
        db.flush()
        record.active_version_id  = new_version_id
        record.latest_version_num = new_version_num

        # PDF borrador ya generado en el último save (draft_current.pdf en MinIO).
        # No se encola job adicional aquí para evitar duplicados.

    # ── preview → completed ───────────────────────────────────────────────────
    elif current_status_code == RECORD_STATUS_PREVIEW and target_status == RECORD_STATUS_COMPLETED:
        active_version = db.query(RecordVersion).filter_by(id=record.active_version_id).first()
        if active_version:
            active_version.status_id = final_status_id

        # El listener SQLAlchemy en pdf_dispatch.py detecta el cambio a "completed"
        # y encola el PDF final (sin watermark) con el payload completo correcto.

    # ── preview → pending (devolver a edición) ────────────────────────────────
    # Solo cambia el estado. El draft_current.json sigue intacto para continuar editando.
    # El snapshot versionado en BUCKET_JSON queda como trazabilidad.

    # ── * → deleted ───────────────────────────────────────────────────────────
    elif target_status == RECORD_STATUS_DELETED:
        record.deleted_at = datetime.now(timezone.utc)

    # ── * → cancelled: solo cambia el estado ─────────────────────────────────

    record.status_id  = target_status_id
    record.updated_by = actor_user_id
    db.commit()

    logger.info(f"[minutes] Transición | record={record_id} {current_status_code} → {target_status}")

    return MinuteTransitionResponse(
        record_id   = record_id,
        status      = target_status,
        version_num = int(new_version.version_num) if new_version else None,
        version_id  = new_version.id               if new_version else None,
        message     = f"Transición '{current_status_code}' → '{target_status}' completada.",
    )


# ─── list_minutes ─────────────────────────────────────────────────────────────

def list_minutes(
    db:            Session,
    skip:          int = 0,
    limit:         int = 12,
    status_filter: Optional[str] = None,
    client_id:     Optional[str] = None,
    project_id:    Optional[str] = None,
):
    from schemas.minutes         import MinuteListResponse, MinuteListItem, MinuteTagItem
    from models.record_statuses  import RecordStatus
    from models.tags             import Tag

    query = db.query(Record).filter(Record.deleted_at.is_(None))

    if status_filter:
        status_obj = db.query(RecordStatus).filter_by(code=status_filter).first()
        if status_obj:
            query = query.filter(Record.status_id == status_obj.id)

    if client_id:
        query = query.filter(Record.client_id == client_id)
    if project_id:
        query = query.filter(Record.project_id == project_id)

    total   = query.count()
    records = query.order_by(Record.created_at.desc()).offset(skip).limit(limit).all()

    items = []
    for rec in records:
        status_row   = db.query(RecordStatus).filter_by(id=rec.status_id).first()
        status_code  = status_row.code if status_row else "unknown"

        client_name  = getattr(getattr(rec, "client",  None), "name", None)
        project_name = getattr(getattr(rec, "project", None), "name", None)

        participant_names = []
        if hasattr(rec, "participants"):
            participant_names = [p.full_name for p in rec.participants if p.full_name]

        tag_items = []
        if hasattr(rec, "tags"):
            tag_items = [
                MinuteTagItem(label=t.name, color=t.color or "#6B7280")
                for t in rec.tags
            ]

        items.append(MinuteListItem(
            id=rec.id,
            title=rec.title or "",
            date=rec.document_date.isoformat() if rec.document_date else None,
            time=None,
            status=status_code,
            client=client_name,
            project=project_name,
            participants=participant_names,
            summary=getattr(rec, "summary", None),
            tags=tag_items,
        ))

    from schemas.minutes import MinuteListResponse
    return MinuteListResponse(minutes=items, total=total, skip=skip, limit=limit)

# ─── get_minute_versions ──────────────────────────────────────────────────────

def get_minute_versions(db: Session, record_id: str) -> "MinuteVersionsResponse":
    """
    Retorna todas las RecordVersion de una minuta ordenadas por version_num desc.
    Incluye autor (nombre completo o username), fecha, estado y commit_message.
    """
    from schemas.minutes import MinuteVersionsResponse, MinuteVersionItem
    from models.version_statuses import VersionStatus

    record = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if record is None:
        raise HTTPException(status_code=404,
            detail={"error": "record_not_found", "message": f"Minuta '{record_id}' no encontrada."})

    versions_rows = (
        db.query(RecordVersion)
        .filter(RecordVersion.record_id == record_id, RecordVersion.deleted_at.is_(None))
        .order_by(RecordVersion.version_num.desc())
        .all()
    )

    VERSION_STATUS_LABELS = {
        "snapshot": "Borrador",
        "final":    "Publicada",
    }

    items = []
    for v in versions_rows:
        # Autor
        published_by_name = None
        if v.published_by_user:
            profile = getattr(v.published_by_user, "profile", None)
            published_by_name = (
                getattr(profile, "full_name", None)
                or getattr(v.published_by_user, "username", None)
            )

        # Estado
        vs: VersionStatus = v.status
        status_code  = vs.code  if vs else "unknown"
        status_label = VERSION_STATUS_LABELS.get(status_code, status_code)

        items.append(MinuteVersionItem(
            version_id    = str(v.id),
            version_num   = int(v.version_num),
            version_label = f"v{v.version_num}",
            status_code   = status_code,
            status_label  = status_label,
            published_at  = v.published_at.isoformat() if v.published_at else None,
            published_by  = published_by_name,
            commit_message = v.summary_text,
        ))

    return MinuteVersionsResponse(record_id=record_id, versions=items)
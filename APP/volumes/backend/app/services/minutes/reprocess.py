from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.config import settings
from core.datetime_utils import assume_utc, utc_now, utc_now_db
from models.ai_profiles import AiProfile
from models.minute_transaction import MinuteTransaction
from models.objects import Object
from models.record_artifacts import RecordArtifact
from models.records import Record
from models.user import User
from schemas.minutes import MinuteReprocessResponse
from services.minutes import catalogs as minute_catalogs
from services.minutes import constants as minute_constants
from services.minutes import queue as minute_queue
from services.minutes import sanitizers as minute_sanitizers
from services.minutes import storage as minute_storage

logger = logging.getLogger(__name__)

STALE_PROCESSING_MINUTES = max(1, int(getattr(settings, "minutes_stale_processing_minutes", 10) or 10))


def _now_utc() -> datetime:
    return utc_now()


def get_latest_minute_transaction(db: Session, record_id: str) -> MinuteTransaction | None:
    return (
        db.query(MinuteTransaction)
        .filter(MinuteTransaction.record_id == record_id)
        .order_by(MinuteTransaction.created_at.desc())
        .first()
    )


def get_reprocess_eligibility(
    record_status_code: str,
    latest_tx: MinuteTransaction | None,
) -> tuple[bool, str | None]:
    if record_status_code in {
        minute_constants.RECORD_STATUS_LLM_FAILED,
        minute_constants.RECORD_STATUS_PROC_ERROR,
    }:
        return True, "record-error"

    if record_status_code != minute_constants.RECORD_STATUS_IN_PROGRESS or latest_tx is None:
        return False, None

    tx_status = str(latest_tx.status or "").strip()
    if tx_status == "failed":
        return True, "stale-failed-transaction"

    reference_dt = assume_utc(latest_tx.updated_at or latest_tx.created_at)
    if tx_status in {"pending", "processing"} and reference_dt:
        if _now_utc() - reference_dt >= timedelta(minutes=STALE_PROCESSING_MINUTES):
            return True, "stale-processing"

    return False, None


def _build_reprocess_input_schema(
    db: Session,
    record: Record,
    ai_profile: AiProfile,
    actor_user_id: str,
) -> dict:
    from models.record_version_participant import RecordVersionParticipant

    participants: list[str] = []
    if record.active_version_id:
        participant_rows = (
            db.query(RecordVersionParticipant)
            .filter(RecordVersionParticipant.record_version_id == record.active_version_id)
            .order_by(RecordVersionParticipant.display_name.asc())
            .all()
        )
        participants = [row.display_name for row in participant_rows if row.display_name]

    prepared_by_user = getattr(record, "prepared_by_user", None)
    prepared_by_profile = getattr(prepared_by_user, "profile", None) if prepared_by_user else None
    actor_user = db.query(User).filter(User.id == actor_user_id, User.deleted_at.is_(None)).first()
    actor_profile = getattr(actor_user, "profile", None) if actor_user else None
    prepared_by_name = (
        getattr(prepared_by_profile, "full_name", None)
        or getattr(prepared_by_user, "username", None)
        or getattr(actor_profile, "full_name", None)
        or getattr(actor_user, "username", None)
        or "Sistema"
    )

    meeting_info: dict[str, str] = {
        "scheduledDate": record.document_date.isoformat() if record.document_date else "",
        "scheduledStartTime": minute_sanitizers.format_hhmm(record.scheduled_start_time) or "",
        "scheduledEndTime": minute_sanitizers.format_hhmm(record.scheduled_end_time) or "",
    }
    if record.actual_start_time:
        meeting_info["actualStartTime"] = minute_sanitizers.format_hhmm(record.actual_start_time) or ""
    if record.actual_end_time:
        meeting_info["actualEndTime"] = minute_sanitizers.format_hhmm(record.actual_end_time) or ""
    if record.location:
        meeting_info["location"] = record.location
    if record.title:
        meeting_info["title"] = record.title

    return {
        "meetingInfo": meeting_info,
        "projectInfo": {
            "client": getattr(getattr(record, "client", None), "name", None) or "",
            "clientId": str(record.client_id) if record.client_id else None,
            "project": getattr(getattr(record, "project", None), "name", None) or "",
            "projectId": str(record.project_id) if record.project_id else None,
        },
        "declaredParticipants": {
            "attendees": participants,
        },
        "profileInfo": {
            "profileId": str(ai_profile.id),
            "profileName": ai_profile.name,
        },
        "preparedBy": prepared_by_name,
        "systemPrompt": {
            "name": minute_constants.PROMPT_FILE,
            "signedSha": minute_storage.get_prompt_sha(),
        },
        "generationOptions": {
            "language": "es",
        },
    }


def _load_input_objects_meta(db: Session, record_id: str) -> list[dict]:
    from models.artifact_states import ArtifactState
    from models.artifact_types import ArtifactType

    art_transcript_id = minute_catalogs.get_catalog_id(
        db,
        ArtifactType,
        minute_constants.ART_INPUT_TRANSCRIPT,
    )
    art_summary_id = minute_catalogs.get_catalog_id(
        db,
        ArtifactType,
        minute_constants.ART_INPUT_SUMMARY,
    )
    art_state_ready_id = minute_catalogs.get_catalog_id(
        db,
        ArtifactState,
        minute_constants.ART_STATE_READY,
    )

    rows = (
        db.query(RecordArtifact, Object)
        .join(Object, Object.id == RecordArtifact.object_id)
        .filter(
            RecordArtifact.record_id == record_id,
            RecordArtifact.deleted_at.is_(None),
            Object.deleted_at.is_(None),
            Object.object_key.like(f"{record_id}/inputs/%"),
        )
        .order_by(RecordArtifact.created_at.asc())
        .all()
    )

    objects_meta: list[dict] = []
    seen_object_ids: set[str] = set()

    for artifact, obj in rows:
        object_id = str(obj.id)
        if object_id in seen_object_ids:
            continue
        seen_object_ids.add(object_id)
        filename = Path(obj.object_key).name or artifact.natural_name or "adjunto"
        objects_meta.append(
            {
                "obj_id": object_id,
                "obj_key": obj.object_key,
                "sha256": obj.sha256,
                "size_bytes": int(obj.size_bytes or 0),
                "mime": obj.content_type or "application/octet-stream",
                "art_type_id": artifact.artifact_type_id,
                "art_state_id": artifact.artifact_state_id or art_state_ready_id,
                "filename": filename,
            }
        )

    if objects_meta:
        return objects_meta

    fallback_rows = (
        db.query(Object)
        .filter(
            Object.deleted_at.is_(None),
            Object.object_key.like(f"{record_id}/inputs/%"),
        )
        .order_by(Object.created_at.asc())
        .all()
    )

    for obj in fallback_rows:
        filename = Path(obj.object_key).name or "adjunto"
        file_type = minute_sanitizers.detect_input_file_type(filename)
        objects_meta.append(
            {
                "obj_id": str(obj.id),
                "obj_key": obj.object_key,
                "sha256": obj.sha256,
                "size_bytes": int(obj.size_bytes or 0),
                "mime": obj.content_type or "application/octet-stream",
                "art_type_id": art_transcript_id if file_type == "transcript" else art_summary_id,
                "art_state_id": art_state_ready_id,
                "filename": filename,
            }
        )

    if not objects_meta:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "minute_inputs_missing",
                "message": "La minuta no tiene adjuntos de entrada disponibles para reprocesar.",
            },
        )

    return objects_meta


def _build_file_metadata(input_objects_meta: list[dict]) -> list[dict]:
    items: list[dict] = []
    for meta in input_objects_meta:
        filename = str(meta.get("filename") or "adjunto")
        file_type = minute_sanitizers.detect_input_file_type(filename)
        items.append(
            {
                "fileName": filename,
                "mimeType": meta.get("mime") or "application/octet-stream",
                "sha256": meta.get("sha256"),
                "fileType": file_type if file_type in {"transcript", "summary"} else "attachment",
                "objKey": meta.get("obj_key") or filename,
            }
        )
    return items


async def reprocess_minute(
    db: Session,
    record_id: str,
    actor_user_id: str,
) -> MinuteReprocessResponse:
    from models.record_statuses import RecordStatus

    record = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "record_not_found",
                "message": f"Minuta '{record_id}' no encontrada.",
            },
        )

    status_row = db.query(RecordStatus).filter_by(id=record.status_id).first()
    record_status_code = status_row.code if status_row else "unknown"
    latest_tx = get_latest_minute_transaction(db, record_id)
    can_reprocess, reprocess_reason = get_reprocess_eligibility(record_status_code, latest_tx)

    if not can_reprocess:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "minute_not_reprocessable",
                "message": "La minuta solo puede reprocesarse cuando está en error o en un procesamiento atascado.",
            },
        )

    ai_profile = (
        db.query(AiProfile)
        .filter(AiProfile.id == record.ai_profile_id, AiProfile.deleted_at.is_(None))
        .first()
    )
    if ai_profile is None or not bool(ai_profile.is_active):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "ai_profile_unavailable",
                "message": "La minuta no tiene un perfil IA activo disponible para reprocesar.",
            },
        )

    input_objects_meta = _load_input_objects_meta(db, record_id)
    ai_input_schema = _build_reprocess_input_schema(db, record, ai_profile, actor_user_id)
    file_metadata = _build_file_metadata(input_objects_meta)
    transaction_id = str(uuid.uuid4())
    in_progress_status_id = minute_catalogs.get_catalog_id(
        db,
        RecordStatus,
        minute_constants.RECORD_STATUS_IN_PROGRESS,
    )

    if latest_tx and latest_tx.status in {"pending", "processing"} and reprocess_reason in {
        "stale-processing",
        "stale-failed-transaction",
    }:
        latest_tx.status = "failed"
        latest_tx.completed_at = utc_now_db()
        previous_error = str(latest_tx.error_message or "").strip()
        replacement_note = "Reemplazada por reproceso manual."
        latest_tx.error_message = (
            f"{previous_error} {replacement_note}".strip()
            if previous_error
            else replacement_note
        )[:1000]

    record.status_id = in_progress_status_id
    record.updated_by = actor_user_id

    tx = MinuteTransaction(
        id=transaction_id,
        record_id=record_id,
        status="processing",
        requested_by=actor_user_id,
        ai_profile_id=record.ai_profile_id,
    )
    db.add(tx)
    db.commit()

    job_payload = {
        "type": "generate_minute",
        "transaction_id": transaction_id,
        "record_id": record_id,
        "requested_by_id": actor_user_id,
        "ai_input_schema": ai_input_schema,
        "file_metadata": file_metadata,
        "input_objects_meta": input_objects_meta,
        "ai_profile": {
            "profile_id": str(ai_profile.id),
            "profile_name": ai_profile.name,
            "profile_description": ai_profile.description or "",
            "profile_prompt": ai_profile.prompt or "",
        },
        "catalog_ids": {},
    }

    try:
        await minute_queue.enqueue_job(minute_constants.QUEUE_MINUTES, job_payload)
    except Exception as exc:
        logger.error("[minutes] No se pudo encolar reproceso | record=%s tx=%s err=%s", record_id, transaction_id, exc)
        proc_error_status_id = minute_catalogs.get_catalog_id(
            db,
            RecordStatus,
            minute_constants.RECORD_STATUS_PROC_ERROR,
        )
        tx.status = "failed"
        tx.completed_at = utc_now_db()
        tx.error_message = f"No se pudo encolar el reproceso: {exc}"[:1000]
        record.status_id = proc_error_status_id
        record.updated_by = actor_user_id
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "reprocess_enqueue_error",
                "message": "No se pudo iniciar el reproceso de la minuta.",
            },
        )

    logger.info(
        "[minutes] Reproceso encolado | record=%s tx=%s reason=%s",
        record_id,
        transaction_id,
        reprocess_reason,
    )
    return MinuteReprocessResponse(
        transaction_id=transaction_id,
        record_id=record_id,
        status="processing",
        message="Reproceso iniciado. La minuta volvió a cola de procesamiento.",
    )

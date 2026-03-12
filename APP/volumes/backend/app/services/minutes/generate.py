from __future__ import annotations

import io
import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.config import settings
from db.minio_client import get_minio_client
from models.ai_profiles import AiProfile
from models.minute_transaction import MinuteTransaction
from models.records import Record
from schemas.minutes import MinuteGenerateRequest, MinuteGenerateResponse
from services.minutes import catalogs as minute_catalogs
from services.minutes import constants as minute_constants
from services.minutes import queue as minute_queue
from services.minutes import sanitizers as minute_sanitizers
from services.minutes import storage as minute_storage

logger = logging.getLogger(__name__)


def build_input_schema(request: MinuteGenerateRequest) -> dict:
    meeting_info = request.meeting_info
    project_info = request.project_info
    participants = request.participants
    profile_info = request.profile_info

    schema: dict = {
        "meetingInfo": {
            "scheduledDate": meeting_info.scheduled_date,
            "scheduledStartTime": meeting_info.scheduled_start_time,
            "scheduledEndTime": meeting_info.scheduled_end_time,
        },
        "projectInfo": {
            "client": project_info.client,
            "clientId": project_info.client_id,
            "project": project_info.project,
            "projectId": project_info.project_id,
        },
        "declaredParticipants": {
            "attendees": participants.attendees,
        },
        "profileInfo": {
            "profileId": profile_info.profile_id,
            "profileName": profile_info.profile_name,
        },
        "preparedBy": request.prepared_by,
        "systemPrompt": {
            "name": minute_constants.PROMPT_FILE,
            "signedSha": minute_storage.get_prompt_sha(),
        },
    }
    if meeting_info.actual_start_time:
        schema["meetingInfo"]["actualStartTime"] = meeting_info.actual_start_time
    if meeting_info.actual_end_time:
        schema["meetingInfo"]["actualEndTime"] = meeting_info.actual_end_time
    if meeting_info.location:
        schema["meetingInfo"]["location"] = meeting_info.location
    if meeting_info.title:
        schema["meetingInfo"]["title"] = meeting_info.title
    if project_info.category:
        schema["projectInfo"]["category"] = project_info.category
    if participants.invited:
        schema["declaredParticipants"]["invited"] = participants.invited
    if participants.copy_recipients:
        schema["declaredParticipants"]["copyRecipients"] = participants.copy_recipients
    if request.additional_notes:
        schema["additionalNotes"] = request.additional_notes
    if request.generation_options:
        schema["generationOptions"] = {"language": request.generation_options.language}
    return schema


async def generate_minute(
    db: Session,
    request: MinuteGenerateRequest,
    files: list[UploadFile],
    requested_by_id: str,
) -> MinuteGenerateResponse:
    from models.artifact_states import ArtifactState
    from models.artifact_types import ArtifactType
    from models.buckets import Bucket
    from models.record_statuses import RecordStatus
    from models.record_types import RecordType

    request = minute_sanitizers.sanitize_generate_request(request)
    minio = get_minio_client()

    bucket_inputs_id = minute_catalogs.get_catalog_id(
        db,
        Bucket,
        minute_constants.BUCKET_CODE_INPUTS,
    )
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
    status_in_progress_id = minute_catalogs.get_catalog_id(
        db,
        RecordStatus,
        minute_constants.RECORD_STATUS_IN_PROGRESS,
    )
    record_type_id = minute_catalogs.get_catalog_id(
        db,
        RecordType,
        minute_constants.RECORD_TYPE_MINUTE,
    )

    record_id = str(uuid.uuid4())
    transaction_id = str(uuid.uuid4())

    input_objects_meta = []
    summary_candidates: list[bytes] = []
    for upload in files:
        raw, safe_name, mime, sha = await minute_sanitizers.sanitize_upload_file(
            upload,
            max_bytes=settings.minutes_max_file_size_mb * 1024 * 1024,
        )
        obj_key = f"{record_id}/inputs/{safe_name}"
        obj_id = str(uuid.uuid4())
        ext = Path(safe_name).suffix.lstrip(".")

        minio.put_object(
            bucket_name=minute_constants.BUCKET_INPUTS,
            object_name=obj_key,
            data=io.BytesIO(raw),
            length=len(raw),
            content_type=mime,
        )

        is_transcript = minute_sanitizers.detect_input_file_type(safe_name) == "transcript"
        art_type_id = art_transcript_id if is_transcript else art_summary_id
        if not is_transcript:
            summary_candidates.append(raw)

        db.add(
            minute_storage.build_object_row(
                obj_id,
                bucket_inputs_id,
                obj_key,
                mime,
                ext,
                len(raw),
                sha,
                requested_by_id,
            )
        )

        input_objects_meta.append(
            {
                "obj_id": obj_id,
                "obj_key": obj_key,
                "sha256": sha,
                "size_bytes": len(raw),
                "mime": mime,
                "art_type_id": art_type_id,
                "art_state_id": art_state_ready_id,
                "filename": safe_name,
            }
        )

    meeting_info = request.meeting_info
    project_info = request.project_info
    intro_snippet = minute_sanitizers.build_initial_intro_snippet(
        summary_candidates,
        request.additional_notes,
    )

    record = Record(
        id=record_id,
        record_type_id=record_type_id,
        status_id=status_in_progress_id,
        ai_profile_id=request.profile_info.profile_id,
        title=meeting_info.title or f"{project_info.client} - {meeting_info.scheduled_date}",
        client_id=project_info.client_id,
        project_id=project_info.project_id,
        document_date=meeting_info.scheduled_date,
        location=meeting_info.location,
        scheduled_start_time=minute_sanitizers.parse_hhmm(meeting_info.scheduled_start_time),
        scheduled_end_time=minute_sanitizers.parse_hhmm(meeting_info.scheduled_end_time),
        actual_start_time=minute_sanitizers.parse_hhmm(meeting_info.actual_start_time),
        actual_end_time=minute_sanitizers.parse_hhmm(meeting_info.actual_end_time),
        prepared_by_user_id=requested_by_id,
        intro_snippet=intro_snippet,
        latest_version_num=0,
        created_by=requested_by_id,
    )
    db.add(record)

    input_schema = build_input_schema(request)

    tx = MinuteTransaction(
        id=transaction_id,
        record_id=record_id,
        status="processing",
        requested_by=requested_by_id,
    )
    db.add(tx)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.error("[minutes] TX1 IntegrityError: %s", exc)
        raise HTTPException(status_code=500, detail="Error al crear el registro de minuta.")

    ai_profile_obj = db.query(AiProfile).filter(AiProfile.id == request.profile_info.profile_id).first()

    job_payload = {
        "type": "generate_minute",
        "transaction_id": transaction_id,
        "record_id": record_id,
        "requested_by_id": requested_by_id,
        "ai_input_schema": input_schema,
        "file_metadata": [
            {
                "fileName": metadata["filename"],
                "mimeType": metadata["mime"],
                "sha256": metadata["sha256"],
                "fileType": "transcript" if metadata["art_type_id"] == art_transcript_id else "summary",
                "objKey": metadata["obj_key"],
            }
            for metadata in input_objects_meta
        ],
        "input_objects_meta": input_objects_meta,
        "ai_profile": {
            "profile_id": str(ai_profile_obj.id) if ai_profile_obj else request.profile_info.profile_id,
            "profile_name": ai_profile_obj.name if ai_profile_obj else request.profile_info.profile_name,
            "profile_description": ai_profile_obj.description or "" if ai_profile_obj else "",
            "profile_prompt": ai_profile_obj.prompt or "" if ai_profile_obj else "",
        },
        "catalog_ids": {},
    }

    try:
        await minute_queue.enqueue_job(minute_constants.QUEUE_MINUTES, job_payload)
    except Exception as exc:
        logger.error("[minutes] No se pudo encolar el job: %s", exc)

    return MinuteGenerateResponse(
        transaction_id=transaction_id,
        record_id=record_id,
        status="pending",
        message="Solicitud recibida. La minuta se esta generando.",
    )

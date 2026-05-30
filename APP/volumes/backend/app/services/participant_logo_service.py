from __future__ import annotations

import uuid
from io import BytesIO

from fastapi import HTTPException, UploadFile, status
from minio.error import S3Error
from sqlalchemy.orm import Session

from core.datetime_utils import utc_now_db
from db.minio_client import get_minio_client
from models.buckets import Bucket
from models.objects import Object
from models.participant import Participant
from services.upload_validation import sanitize_uploaded_image_content

PARTICIPANT_LOGO_BUCKET = "minuetaitor-attach"
PARTICIPANT_LOGO_PREFIX = "participant-logos"
PARTICIPANT_LOGO_BUCKET_CODE = "attachments_container"
MAX_PARTICIPANT_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_PARTICIPANT_LOGO_TYPES = {"image/jpeg", "image/png"}


def build_participant_logo_key(participant_id: str, object_id: str, file_ext: str) -> str:
    return f"{PARTICIPANT_LOGO_PREFIX}/{participant_id}/{object_id}.{file_ext}"


def build_participant_logo_url(participant_id: str, object_id: str | None) -> str | None:
    if not object_id:
        return None
    return f"/api/v1/participants/{participant_id}/logo?v={object_id}"


def get_participant_logo_url_if_exists(participant: Participant) -> str | None:
    avatar_object = getattr(participant, "avatar_object", None)
    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        return None
    return build_participant_logo_url(str(participant.id), str(avatar_object.id))


def _get_attach_bucket_id(db: Session) -> int:
    bucket = (
        db.query(Bucket)
        .filter(Bucket.code == PARTICIPANT_LOGO_BUCKET_CODE, Bucket.deleted_at.is_(None))
        .first()
    )
    if not bucket:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Bucket de adjuntos no configurado para logos de participantes.",
        )
    return int(bucket.id)


async def save_participant_logo(
    db: Session,
    participant: Participant,
    file: UploadFile,
    *,
    actor_user_id: str | None,
) -> str:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo esta vacio.")
    if len(content) > MAX_PARTICIPANT_LOGO_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="El logo supera 2 MB.")
    content, content_type, file_ext = sanitize_uploaded_image_content(
        content=content,
        declared_content_type=file.content_type,
        allowed_types=ALLOWED_PARTICIPANT_LOGO_TYPES,
        label="logo",
        max_size=(512, 512),
    )
    if len(content) > MAX_PARTICIPANT_LOGO_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="El logo sanitizado supera 2 MB.")

    object_id = str(uuid.uuid4())
    object_key = build_participant_logo_key(str(participant.id), object_id, file_ext)
    bucket_id = _get_attach_bucket_id(db)

    minio = get_minio_client()
    result = minio.put_object(
        bucket_name=PARTICIPANT_LOGO_BUCKET,
        object_name=object_key,
        data=BytesIO(content),
        length=len(content),
        content_type=content_type,
    )

    object_row = Object(
        id=object_id,
        bucket_id=bucket_id,
        object_key=object_key,
        content_type=content_type,
        file_ext=file_ext,
        size_bytes=len(content),
        etag=getattr(result, "etag", None),
        created_by=actor_user_id,
    )
    db.add(object_row)

    previous_object = getattr(participant, "avatar_object", None)
    now = utc_now_db()
    if previous_object and not getattr(previous_object, "deleted_at", None):
        previous_object.deleted_at = now
        previous_object.deleted_by = actor_user_id
        try:
            minio.remove_object(PARTICIPANT_LOGO_BUCKET, previous_object.object_key)
        except S3Error as exc:
            if exc.code not in {"NoSuchKey", "NoSuchObject"}:
                raise

    participant.avatar_object_id = object_id
    participant.updated_by = actor_user_id
    db.commit()
    db.refresh(participant)
    return build_participant_logo_url(str(participant.id), object_id)


def remove_participant_logo(db: Session, participant: Participant, *, actor_user_id: str | None) -> None:
    avatar_object = getattr(participant, "avatar_object", None)
    now = utc_now_db()

    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        participant.avatar_object_id = None
        participant.updated_by = actor_user_id
        db.commit()
        db.refresh(participant)
        return

    minio = get_minio_client()
    try:
        minio.remove_object(PARTICIPANT_LOGO_BUCKET, avatar_object.object_key)
    except S3Error as exc:
        if exc.code not in {"NoSuchKey", "NoSuchObject"}:
            raise

    avatar_object.deleted_at = now
    avatar_object.deleted_by = actor_user_id
    participant.avatar_object_id = None
    participant.updated_by = actor_user_id
    db.commit()
    db.refresh(participant)


def read_participant_logo(db: Session, participant: Participant) -> tuple[bytes, str]:
    avatar_object = getattr(participant, "avatar_object", None)
    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo no encontrado.")

    minio = get_minio_client()
    key = avatar_object.object_key

    try:
        stat = minio.stat_object(PARTICIPANT_LOGO_BUCKET, key)
        response = minio.get_object(PARTICIPANT_LOGO_BUCKET, key)
        try:
            return response.read(), stat.content_type or "application/octet-stream"
        finally:
            response.close()
            response.release_conn()
    except S3Error as exc:
        if exc.code in {"NoSuchKey", "NoSuchObject"}:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo no encontrado.")
        raise

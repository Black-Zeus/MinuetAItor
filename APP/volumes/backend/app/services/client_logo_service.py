from __future__ import annotations

import logging
from pathlib import Path
import uuid
from io import BytesIO

from fastapi import HTTPException, UploadFile, status
from minio.error import S3Error
from sqlalchemy.orm import Session

from core.datetime_utils import utc_now_db
from db.minio_client import get_minio_client
from models.buckets import Bucket
from models.clients import Client
from models.objects import Object

CLIENT_LOGO_BUCKET = "minuetaitor-attach"
CLIENT_LOGO_PREFIX = "client-logos"
CLIENT_LOGO_BUCKET_CODE = "attachments_container"
MAX_CLIENT_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_CLIENT_LOGO_TYPES = {"image/jpeg", "image/png"}
logger = logging.getLogger(__name__)


def build_client_logo_key(client_id: str, object_id: str, filename: str | None = None) -> str:
    suffix = Path(filename or "").suffix.lower()
    if not suffix:
        suffix = ".bin"
    return f"{CLIENT_LOGO_PREFIX}/{client_id}/{object_id}{suffix}"


def build_client_logo_url(client_id: str, object_id: str | None) -> str | None:
    if not object_id:
        return None
    return f"/api/v1/clients/{client_id}/logo?v={object_id}"


def get_client_logo_url_if_exists(client: Client) -> str | None:
    avatar_object = getattr(client, "avatar_object", None)
    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        return None
    return build_client_logo_url(str(client.id), str(avatar_object.id))


def _get_attach_bucket_id(db: Session) -> int:
    bucket = (
        db.query(Bucket)
        .filter(Bucket.code == CLIENT_LOGO_BUCKET_CODE, Bucket.deleted_at.is_(None))
        .first()
    )
    if not bucket:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Bucket de adjuntos no configurado para logos de clientes.",
        )
    return int(bucket.id)


async def save_client_logo(
    db: Session,
    client: Client,
    file: UploadFile,
    *,
    actor_user_id: str | None,
) -> str:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CLIENT_LOGO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de logo no soportado. Usa JPEG o PNG.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo esta vacio.")
    if len(content) > MAX_CLIENT_LOGO_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="El logo supera 2 MB.")

    object_id = str(uuid.uuid4())
    object_key = build_client_logo_key(str(client.id), object_id, file.filename)
    file_ext = Path(file.filename or "").suffix.lower().lstrip(".") or "bin"
    bucket_id = _get_attach_bucket_id(db)

    minio = get_minio_client()
    result = minio.put_object(
        bucket_name=CLIENT_LOGO_BUCKET,
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

    previous_object = getattr(client, "avatar_object", None)
    now = utc_now_db()
    if previous_object and not getattr(previous_object, "deleted_at", None):
        previous_object.deleted_at = now
        previous_object.deleted_by = actor_user_id
        try:
            minio.remove_object(CLIENT_LOGO_BUCKET, previous_object.object_key)
        except S3Error as exc:
            if exc.code not in {"NoSuchKey", "NoSuchObject"}:
                raise

    client.avatar_object_id = object_id
    client.updated_by = actor_user_id
    db.commit()
    db.refresh(client)
    return build_client_logo_url(str(client.id), object_id)


def remove_client_logo(db: Session, client: Client, *, actor_user_id: str | None) -> None:
    avatar_object = getattr(client, "avatar_object", None)
    now = utc_now_db()

    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        client.avatar_object_id = None
        client.updated_by = actor_user_id
        db.commit()
        db.refresh(client)
        return

    minio = get_minio_client()
    try:
        minio.remove_object(CLIENT_LOGO_BUCKET, avatar_object.object_key)
    except S3Error as exc:
        if exc.code not in {"NoSuchKey", "NoSuchObject"}:
            raise

    avatar_object.deleted_at = now
    avatar_object.deleted_by = actor_user_id
    client.avatar_object_id = None
    client.updated_by = actor_user_id
    db.commit()
    db.refresh(client)


def read_client_logo(db: Session, client: Client) -> tuple[bytes, str]:
    avatar_object = getattr(client, "avatar_object", None)
    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo no encontrado.")

    minio = get_minio_client()
    key = avatar_object.object_key

    try:
        stat = minio.stat_object(CLIENT_LOGO_BUCKET, key)
        response = minio.get_object(CLIENT_LOGO_BUCKET, key)
        try:
            return response.read(), stat.content_type or "application/octet-stream"
        finally:
            response.close()
            response.release_conn()
    except S3Error as exc:
        if exc.code in {"NoSuchKey", "NoSuchObject"}:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo no encontrado.")
        raise

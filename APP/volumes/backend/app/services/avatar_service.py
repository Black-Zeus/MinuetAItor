from __future__ import annotations

from io import BytesIO
import logging
from time import time

from fastapi import HTTPException, UploadFile, status
from minio.error import S3Error

from db.minio_client import get_minio_client

AVATAR_BUCKET = "minuetaitor-attach"
AVATAR_PREFIX = "avatars"
MAX_AVATAR_BYTES = 2 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
logger = logging.getLogger(__name__)


def build_avatar_key(user_id: str) -> str:
    return f"{AVATAR_PREFIX}/{user_id}"


def build_avatar_url(user_id: str) -> str:
    return f"/api/v1/auth/users/{user_id}/avatar?v={int(time())}"


def get_avatar_url_if_exists(user_id: str) -> str | None:
    minio = get_minio_client()
    try:
        minio.stat_object(AVATAR_BUCKET, build_avatar_key(user_id))
        return build_avatar_url(user_id)
    except S3Error as exc:
        if exc.code in {"NoSuchKey", "NoSuchObject"}:
            return None
        logger.warning("[avatar] No se pudo validar avatar de usuario %s: %s", user_id, exc)
        return None
    except Exception as exc:
        logger.warning("[avatar] No se pudo validar avatar de usuario %s: %s", user_id, exc)
        return None


async def save_user_avatar(user_id: str, file: UploadFile) -> str:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de avatar no soportado. Usa JPEG, PNG, WebP o GIF.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo esta vacio.")
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="El avatar supera 2 MB.")

    minio = get_minio_client()
    minio.put_object(
        bucket_name=AVATAR_BUCKET,
        object_name=build_avatar_key(user_id),
        data=BytesIO(content),
        length=len(content),
        content_type=content_type,
    )
    return build_avatar_url(user_id)


def remove_user_avatar(user_id: str) -> None:
    minio = get_minio_client()
    try:
        minio.remove_object(AVATAR_BUCKET, build_avatar_key(user_id))
    except S3Error as exc:
        if exc.code not in {"NoSuchKey", "NoSuchObject"}:
            raise


def read_user_avatar(user_id: str) -> tuple[bytes, str]:
    minio = get_minio_client()
    key = build_avatar_key(user_id)

    try:
        stat = minio.stat_object(AVATAR_BUCKET, key)
        response = minio.get_object(AVATAR_BUCKET, key)
        try:
            return response.read(), stat.content_type or "application/octet-stream"
        finally:
            response.close()
            response.release_conn()
    except S3Error as exc:
        if exc.code in {"NoSuchKey", "NoSuchObject"}:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar no encontrado.")
        raise

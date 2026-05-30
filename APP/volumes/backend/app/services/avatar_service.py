from __future__ import annotations

import uuid
from io import BytesIO

from fastapi import HTTPException, UploadFile, status
from minio.error import S3Error
from sqlalchemy.orm import Session, joinedload

from core.datetime_utils import utc_now_db
from db.minio_client import get_minio_client
from models.buckets import Bucket
from models.objects import Object
from models.user import User
from services.upload_validation import build_image_derivative, sanitize_uploaded_image_content

AVATAR_BUCKET = "minuetaitor-attach"
AVATAR_PREFIX = "avatars"
AVATAR_BUCKET_CODE = "attachments_container"
MAX_AVATAR_BYTES = 2 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
AVATAR_FULL_SIZE = (512, 512)
AVATAR_THUMB_SIZE = (128, 128)

def build_avatar_key(user_id: str, object_id: str, file_ext: str) -> str:
    return f"{AVATAR_PREFIX}/{user_id}/{object_id}.{file_ext}"


def build_avatar_url(user_id: str, object_id: str | None = None) -> str:
    version = object_id or "current"
    return f"/api/v1/auth/users/{user_id}/avatar?size=thumb&v={version}"


def get_avatar_url_if_exists(user: User) -> str | None:
    avatar_object = getattr(user, "avatar_object", None)
    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        return None
    return build_avatar_url(str(user.id), str(avatar_object.id))


def _get_attach_bucket_id(db: Session) -> int:
    bucket = (
        db.query(Bucket)
        .filter(Bucket.code == AVATAR_BUCKET_CODE, Bucket.deleted_at.is_(None))
        .first()
    )
    if not bucket:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Bucket de adjuntos no configurado para avatares de usuario.",
        )
    return int(bucket.id)


def _get_user_with_avatar(db: Session, user_id: str) -> User:
    user = (
        db.query(User)
        .options(joinedload(User.avatar_object))
        .filter(User.id == user_id, User.deleted_at.is_(None))
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    return user


async def save_user_avatar(
    db: Session,
    user_id: str,
    file: UploadFile,
    *,
    actor_user_id: str | None,
) -> str:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo esta vacio.")
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="El avatar supera 2 MB.")
    content, content_type, file_ext = sanitize_uploaded_image_content(
        content=content,
        declared_content_type=file.content_type,
        allowed_types=ALLOWED_AVATAR_TYPES,
        label="avatar",
        max_size=AVATAR_FULL_SIZE,
        square=True,
    )
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="El avatar sanitizado supera 2 MB.")

    user = _get_user_with_avatar(db, user_id)
    object_id = str(uuid.uuid4())
    object_key = build_avatar_key(str(user.id), object_id, file_ext)
    bucket_id = _get_attach_bucket_id(db)

    minio = get_minio_client()
    result = minio.put_object(
        bucket_name=AVATAR_BUCKET,
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

    previous_object = getattr(user, "avatar_object", None)
    now = utc_now_db()
    if previous_object and not getattr(previous_object, "deleted_at", None):
        previous_object.deleted_at = now
        previous_object.deleted_by = actor_user_id
        try:
            minio.remove_object(AVATAR_BUCKET, previous_object.object_key)
        except S3Error as exc:
            if exc.code not in {"NoSuchKey", "NoSuchObject"}:
                raise

    user.avatar_object_id = object_id
    user.updated_by = actor_user_id
    db.commit()
    db.refresh(user)
    return build_avatar_url(str(user.id), object_id)


def remove_user_avatar(db: Session, user_id: str, *, actor_user_id: str | None) -> None:
    user = _get_user_with_avatar(db, user_id)
    avatar_object = getattr(user, "avatar_object", None)
    now = utc_now_db()
    minio = get_minio_client()

    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        user.avatar_object_id = None
        user.updated_by = actor_user_id
        db.commit()
        db.refresh(user)
        return

    try:
        minio.remove_object(AVATAR_BUCKET, avatar_object.object_key)
    except S3Error as exc:
        if exc.code not in {"NoSuchKey", "NoSuchObject"}:
            raise

    avatar_object.deleted_at = now
    avatar_object.deleted_by = actor_user_id
    user.avatar_object_id = None
    user.updated_by = actor_user_id
    db.commit()
    db.refresh(user)


def read_user_avatar(db: Session, user_id: str, *, size: str = "thumb") -> tuple[bytes, str]:
    user = _get_user_with_avatar(db, user_id)
    avatar_object = getattr(user, "avatar_object", None)
    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar no encontrado.")

    minio = get_minio_client()
    try:
        stat = minio.stat_object(AVATAR_BUCKET, avatar_object.object_key)
        response = minio.get_object(AVATAR_BUCKET, avatar_object.object_key)
        try:
            content = response.read()
            content_type = stat.content_type or "application/octet-stream"
            if str(size or "thumb").lower() == "full":
                return content, content_type
            return build_image_derivative(
                content,
                size=AVATAR_THUMB_SIZE,
                content_type=content_type,
                square=True,
            )
        finally:
            response.close()
            response.release_conn()
    except S3Error as exc:
        if exc.code in {"NoSuchKey", "NoSuchObject"}:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar no encontrado.")
        raise

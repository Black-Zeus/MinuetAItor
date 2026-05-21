from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import uuid

from fastapi import HTTPException, UploadFile, status
from minio.error import S3Error
from sqlalchemy.orm import Session

from db.minio_client import get_minio_client
from models.buckets import Bucket
from models.objects import Object
from models.organization_settings import OrganizationSetting

ORGANIZATION_MEDIA_BUCKET = "minuetaitor-attach"
ORGANIZATION_MEDIA_BUCKET_CODE = "attachments_container"
ORGANIZATION_LOGO_PREFIX = "organization-logo"
ORGANIZATION_BANNER_PREFIX = "organization-banner"
MAX_ORGANIZATION_LOGO_BYTES = 2 * 1024 * 1024
MAX_ORGANIZATION_BANNER_BYTES = 4 * 1024 * 1024
ALLOWED_ORGANIZATION_MEDIA_TYPES = {"image/jpeg", "image/png"}


def build_organization_logo_url(object_id: str | None) -> str | None:
    if not object_id:
        return None
    return f"/api/v1/system/organization/logo?v={object_id}"


def build_organization_banner_url(object_id: str | None) -> str | None:
    if not object_id:
        return None
    return f"/api/v1/system/organization/banner?v={object_id}"


def get_organization_logo_url_if_exists(obj: OrganizationSetting) -> str | None:
    avatar_object = getattr(obj, "avatar_object", None)
    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        return None
    return build_organization_logo_url(str(avatar_object.id))


def get_organization_banner_url_if_exists(obj: OrganizationSetting) -> str | None:
    banner_object = getattr(obj, "banner_object", None)
    if not banner_object or getattr(banner_object, "deleted_at", None):
        return None
    return build_organization_banner_url(str(banner_object.id))


def _build_media_key(prefix: str, object_id: str, filename: str | None = None) -> str:
    suffix = Path(filename or "").suffix.lower()
    if not suffix:
        suffix = ".bin"
    return f"{prefix}/{object_id}{suffix}"


def _get_attach_bucket_id(db: Session) -> int:
    bucket = (
        db.query(Bucket)
        .filter(Bucket.code == ORGANIZATION_MEDIA_BUCKET_CODE, Bucket.deleted_at.is_(None))
        .first()
    )
    if not bucket:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Bucket de adjuntos no configurado para medios de organización.",
        )
    return int(bucket.id)


async def _save_media(
    db: Session,
    obj: OrganizationSetting,
    *,
    file: UploadFile,
    actor_user_id: str | None,
    object_attr: str,
    relationship_attr: str,
    prefix: str,
    max_bytes: int,
) -> str:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_ORGANIZATION_MEDIA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de imagen no soportado. Usa JPEG o PNG.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo esta vacio.")
    if len(content) > max_bytes:
        limit_mb = max_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"La imagen supera {limit_mb} MB.",
        )

    object_id = str(uuid.uuid4())
    object_key = _build_media_key(prefix, object_id, file.filename)
    file_ext = Path(file.filename or "").suffix.lower().lstrip(".") or "bin"
    bucket_id = _get_attach_bucket_id(db)

    minio = get_minio_client()
    result = minio.put_object(
        bucket_name=ORGANIZATION_MEDIA_BUCKET,
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

    previous_object = getattr(obj, relationship_attr, None)
    now = datetime.now(timezone.utc)
    if previous_object and not getattr(previous_object, "deleted_at", None):
        previous_object.deleted_at = now
        previous_object.deleted_by = actor_user_id
        try:
            minio.remove_object(ORGANIZATION_MEDIA_BUCKET, previous_object.object_key)
        except S3Error as exc:
            if exc.code not in {"NoSuchKey", "NoSuchObject"}:
                raise

    setattr(obj, object_attr, object_id)
    obj.updated_by = actor_user_id
    db.commit()
    db.refresh(obj)
    return object_id


def _remove_media(
    db: Session,
    obj: OrganizationSetting,
    *,
    actor_user_id: str | None,
    object_attr: str,
    relationship_attr: str,
) -> None:
    media_object = getattr(obj, relationship_attr, None)
    now = datetime.now(timezone.utc)

    if not media_object or getattr(media_object, "deleted_at", None):
        setattr(obj, object_attr, None)
        obj.updated_by = actor_user_id
        db.commit()
        db.refresh(obj)
        return

    minio = get_minio_client()
    try:
        minio.remove_object(ORGANIZATION_MEDIA_BUCKET, media_object.object_key)
    except S3Error as exc:
        if exc.code not in {"NoSuchKey", "NoSuchObject"}:
            raise

    media_object.deleted_at = now
    media_object.deleted_by = actor_user_id
    setattr(obj, object_attr, None)
    obj.updated_by = actor_user_id
    db.commit()
    db.refresh(obj)


def _read_media(obj: OrganizationSetting, relationship_attr: str) -> tuple[bytes, str]:
    media_object = getattr(obj, relationship_attr, None)
    if not media_object or getattr(media_object, "deleted_at", None):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagen no encontrada.")

    minio = get_minio_client()
    key = media_object.object_key

    try:
        stat = minio.stat_object(ORGANIZATION_MEDIA_BUCKET, key)
        response = minio.get_object(ORGANIZATION_MEDIA_BUCKET, key)
        try:
            return response.read(), stat.content_type or "application/octet-stream"
        finally:
            response.close()
            response.release_conn()
    except S3Error as exc:
        if exc.code in {"NoSuchKey", "NoSuchObject"}:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagen no encontrada.")
        raise


async def save_organization_logo(
    db: Session,
    obj: OrganizationSetting,
    file: UploadFile,
    *,
    actor_user_id: str | None,
) -> str:
    object_id = await _save_media(
        db,
        obj,
        file=file,
        actor_user_id=actor_user_id,
        object_attr="avatar_object_id",
        relationship_attr="avatar_object",
        prefix=ORGANIZATION_LOGO_PREFIX,
        max_bytes=MAX_ORGANIZATION_LOGO_BYTES,
    )
    return build_organization_logo_url(object_id)


def remove_organization_logo(
    db: Session,
    obj: OrganizationSetting,
    *,
    actor_user_id: str | None,
) -> None:
    _remove_media(
        db,
        obj,
        actor_user_id=actor_user_id,
        object_attr="avatar_object_id",
        relationship_attr="avatar_object",
    )


def read_organization_logo(obj: OrganizationSetting) -> tuple[bytes, str]:
    return _read_media(obj, "avatar_object")


async def save_organization_banner(
    db: Session,
    obj: OrganizationSetting,
    file: UploadFile,
    *,
    actor_user_id: str | None,
) -> str:
    object_id = await _save_media(
        db,
        obj,
        file=file,
        actor_user_id=actor_user_id,
        object_attr="banner_object_id",
        relationship_attr="banner_object",
        prefix=ORGANIZATION_BANNER_PREFIX,
        max_bytes=MAX_ORGANIZATION_BANNER_BYTES,
    )
    return build_organization_banner_url(object_id)


def remove_organization_banner(
    db: Session,
    obj: OrganizationSetting,
    *,
    actor_user_id: str | None,
) -> None:
    _remove_media(
        db,
        obj,
        actor_user_id=actor_user_id,
        object_attr="banner_object_id",
        relationship_attr="banner_object",
    )


def read_organization_banner(obj: OrganizationSetting) -> tuple[bytes, str]:
    return _read_media(obj, "banner_object")

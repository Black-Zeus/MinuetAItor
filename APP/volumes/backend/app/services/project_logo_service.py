from __future__ import annotations

from io import BytesIO
from datetime import datetime, timezone
from pathlib import Path
import uuid

from fastapi import HTTPException, UploadFile, status
from minio.error import S3Error
from sqlalchemy.orm import Session

from db.minio_client import get_minio_client
from models.buckets import Bucket
from models.objects import Object
from models.projects import Project

PROJECT_LOGO_BUCKET = "minuetaitor-attach"
PROJECT_LOGO_PREFIX = "project-logos"
PROJECT_LOGO_BUCKET_CODE = "attachments_container"
MAX_PROJECT_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_PROJECT_LOGO_TYPES = {"image/jpeg", "image/png"}


def build_project_logo_key(project_id: str, object_id: str, filename: str | None = None) -> str:
    suffix = Path(filename or "").suffix.lower()
    if not suffix:
        suffix = ".bin"
    return f"{PROJECT_LOGO_PREFIX}/{project_id}/{object_id}{suffix}"


def build_project_logo_url(project_id: str, object_id: str | None) -> str | None:
    if not object_id:
        return None
    return f"/api/v1/projects/{project_id}/logo?v={object_id}"


def get_project_logo_url_if_exists(project: Project) -> str | None:
    avatar_object = getattr(project, "avatar_object", None)
    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        return None
    return build_project_logo_url(str(project.id), str(avatar_object.id))


def _get_attach_bucket_id(db: Session) -> int:
    bucket = (
        db.query(Bucket)
        .filter(Bucket.code == PROJECT_LOGO_BUCKET_CODE, Bucket.deleted_at.is_(None))
        .first()
    )
    if not bucket:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Bucket de adjuntos no configurado para logos de proyectos.",
        )
    return int(bucket.id)


async def save_project_logo(
    db: Session,
    project: Project,
    file: UploadFile,
    *,
    actor_user_id: str | None,
) -> str:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_PROJECT_LOGO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de logo no soportado. Usa JPEG o PNG.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo esta vacio.")
    if len(content) > MAX_PROJECT_LOGO_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="El logo supera 2 MB.")

    object_id = str(uuid.uuid4())
    object_key = build_project_logo_key(str(project.id), object_id, file.filename)
    file_ext = Path(file.filename or "").suffix.lower().lstrip(".") or "bin"
    bucket_id = _get_attach_bucket_id(db)

    minio = get_minio_client()
    result = minio.put_object(
        bucket_name=PROJECT_LOGO_BUCKET,
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

    previous_object = getattr(project, "avatar_object", None)
    now = datetime.now(timezone.utc)
    if previous_object and not getattr(previous_object, "deleted_at", None):
        previous_object.deleted_at = now
        previous_object.deleted_by = actor_user_id
        try:
            minio.remove_object(PROJECT_LOGO_BUCKET, previous_object.object_key)
        except S3Error as exc:
            if exc.code not in {"NoSuchKey", "NoSuchObject"}:
                raise

    project.avatar_object_id = object_id
    project.updated_by = actor_user_id
    db.commit()
    db.refresh(project)
    return build_project_logo_url(str(project.id), object_id)


def remove_project_logo(db: Session, project: Project, *, actor_user_id: str | None) -> None:
    avatar_object = getattr(project, "avatar_object", None)
    now = datetime.now(timezone.utc)

    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        project.avatar_object_id = None
        project.updated_by = actor_user_id
        db.commit()
        db.refresh(project)
        return

    minio = get_minio_client()
    try:
        minio.remove_object(PROJECT_LOGO_BUCKET, avatar_object.object_key)
    except S3Error as exc:
        if exc.code not in {"NoSuchKey", "NoSuchObject"}:
            raise

    avatar_object.deleted_at = now
    avatar_object.deleted_by = actor_user_id
    project.avatar_object_id = None
    project.updated_by = actor_user_id
    db.commit()
    db.refresh(project)


def read_project_logo(db: Session, project: Project) -> tuple[bytes, str]:
    avatar_object = getattr(project, "avatar_object", None)
    if not avatar_object or getattr(avatar_object, "deleted_at", None):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo no encontrado.")

    minio = get_minio_client()
    key = avatar_object.object_key

    try:
        stat = minio.stat_object(PROJECT_LOGO_BUCKET, key)
        response = minio.get_object(PROJECT_LOGO_BUCKET, key)
        try:
            return response.read(), stat.content_type or "application/octet-stream"
        finally:
            response.close()
            response.release_conn()
    except S3Error as exc:
        if exc.code in {"NoSuchKey", "NoSuchObject"}:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo no encontrado.")
        raise

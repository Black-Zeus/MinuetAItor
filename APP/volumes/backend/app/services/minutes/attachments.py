from __future__ import annotations

import logging
import hashlib
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.minio_client import get_minio_client
from models.objects import Object
from models.record_artifacts import RecordArtifact

from services.minutes.constants import BUCKET_INPUTS
from services.minutes.sanitizers import detect_input_file_type

logger = logging.getLogger(__name__)


def get_minute_attachment_blob(
    db: Session,
    record_id: str,
    sha256: str | None = None,
    file_name: str | None = None,
) -> tuple[bytes, str, str]:
    obj = _resolve_attachment_object(
        db=db,
        record_id=record_id,
        sha256=sha256,
        file_name=file_name,
    )

    if not obj:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "attachment_not_found",
                "message": "No se encontró el adjunto solicitado para esta minuta.",
            },
        )

    minio = get_minio_client()
    try:
        response = minio.get_object(BUCKET_INPUTS, obj.object_key)
        file_bytes = response.read()
        response.close()
        response.release_conn()
    except Exception as exc:
        logger.error(
            "[minutes] No se pudo leer adjunto desde MinIO | record=%s sha=%s err=%s",
            record_id,
            sha256,
            exc,
        )
        raise HTTPException(
            status_code=404,
            detail={
                "error": "attachment_unavailable",
                "message": "El archivo adjunto no esta disponible en almacenamiento.",
            },
        )

    filename = Path(obj.object_key).name or f"{sha256}.bin"
    mime_type = obj.content_type or "application/octet-stream"
    return file_bytes, mime_type, filename


def _resolve_attachment_object(
    *,
    db: Session,
    record_id: str,
    sha256: str | None = None,
    file_name: str | None = None,
) -> Optional[Object]:
    clean_sha = str(sha256 or "").strip().lower()
    clean_file_name = Path(str(file_name or "").strip()).name

    base_query = (
        db.query(Object)
        .join(RecordArtifact, RecordArtifact.object_id == Object.id)
        .filter(
            RecordArtifact.record_id == record_id,
            RecordArtifact.deleted_at.is_(None),
            Object.deleted_at.is_(None),
            Object.object_key.like(f"{record_id}/inputs/%"),
        )
        .order_by(RecordArtifact.created_at.desc())
    )

    if clean_sha:
        candidate = base_query.filter(Object.sha256 == clean_sha).first()
        if candidate:
            return candidate

    if clean_file_name:
        suffix = f"/{clean_file_name}"
        return base_query.filter(Object.object_key.like(f"%{suffix}")).first()

    return None


def _is_text_input_object(obj: Object) -> bool:
    content_type = str(obj.content_type or "").lower()
    object_key = str(obj.object_key or "").lower()
    return content_type.startswith("text/") or object_key.endswith(".txt")


def _get_input_attachment_storage_metadata(obj: Object) -> dict[str, Any]:
    size_bytes = int(obj.size_bytes or 0)
    sha256 = obj.sha256 or ""

    if size_bytes > 0 and sha256 and not _is_text_input_object(obj):
        return {"sizeBytes": size_bytes, "sha256": sha256}

    response = None
    try:
        minio = get_minio_client()
        response = minio.get_object(BUCKET_INPUTS, obj.object_key)
        digest = hashlib.sha256()
        calculated_size = 0
        for chunk in response.stream(1024 * 1024):
            if chunk:
                calculated_size += len(chunk)
                digest.update(chunk)
        return {
            "sizeBytes": calculated_size or size_bytes,
            "sha256": digest.hexdigest() if calculated_size > 0 else sha256,
        }
    except Exception as exc:
        logger.warning(
            "[minutes] No se pudo recuperar metadata de adjunto | object=%s err=%s",
            obj.object_key,
            exc,
        )
        return {"sizeBytes": size_bytes, "sha256": sha256}
    finally:
        if response is not None:
            response.close()
            response.release_conn()


def list_minute_input_attachments(db: Session, record_id: str) -> list[dict[str, Any]]:
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

    attachments: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for artifact, obj in rows:
        sha256 = obj.sha256 or ""
        file_name = Path(obj.object_key).name or artifact.natural_name or "adjunto"
        dedupe_key = (sha256, file_name)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        storage_metadata = _get_input_attachment_storage_metadata(obj)
        attachments.append(
            {
                "fileName": file_name,
                "mimeType": obj.content_type or "application/octet-stream",
                "sha256": storage_metadata["sha256"],
                "fileType": detect_input_file_type(file_name),
                "sizeBytes": storage_metadata["sizeBytes"],
            }
        )

    return attachments

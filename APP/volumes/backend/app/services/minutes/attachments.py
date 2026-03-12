from __future__ import annotations

import logging
from pathlib import Path

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
    sha256: str,
) -> tuple[bytes, str, str]:
    obj = (
        db.query(Object)
        .join(RecordArtifact, RecordArtifact.object_id == Object.id)
        .filter(
            RecordArtifact.record_id == record_id,
            RecordArtifact.deleted_at.is_(None),
            Object.deleted_at.is_(None),
            Object.sha256 == sha256,
            Object.object_key.like(f"{record_id}/inputs/%"),
        )
        .order_by(RecordArtifact.created_at.desc())
        .first()
    )

    if not obj:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "attachment_not_found",
                "message": "No se encontro el adjunto solicitado para esta minuta.",
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


def list_minute_input_attachments(db: Session, record_id: str) -> list[dict[str, str]]:
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
    seen: set[str] = set()
    for artifact, obj in rows:
        sha256 = obj.sha256 or ""
        if sha256 and sha256 in seen:
            continue
        if sha256:
            seen.add(sha256)

        file_name = Path(obj.object_key).name or artifact.natural_name or "adjunto"
        attachments.append(
            {
                "fileName": file_name,
                "mimeType": obj.content_type or "application/octet-stream",
                "sha256": sha256,
                "fileType": detect_input_file_type(file_name),
            }
        )

    return attachments


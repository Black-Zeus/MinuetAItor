from __future__ import annotations

import hashlib
import io
import json
import logging
from pathlib import Path
from typing import Optional

from core.config import settings
from db.minio_client import get_minio_client
from models.objects import Object

from services.minutes.constants import PROMPT_FILE

logger = logging.getLogger(__name__)


def get_prompt_sha() -> str:
    try:
        prompt_path = Path(settings.prompt_path_base) / PROMPT_FILE
        return hashlib.sha256(prompt_path.read_bytes()).hexdigest()
    except Exception:
        return "unavailable"


def build_object_row(
    obj_id: str,
    bucket_id,
    key: str,
    content_type: str,
    ext: str,
    size: int,
    sha: str,
    by_id: str,
) -> Object:
    return Object(
        id=obj_id,
        bucket_id=bucket_id,
        object_key=key,
        content_type=content_type,
        file_ext=ext,
        size_bytes=size,
        sha256=sha,
        created_by=by_id,
    )


def read_json(bucket: str, object_key: str) -> Optional[dict]:
    minio = get_minio_client()
    try:
        response = minio.get_object(bucket, object_key)
        raw = response.read()
        response.close()
        response.release_conn()
        return json.loads(raw.decode("utf-8"))
    except Exception as exc:
        logger.warning("[minutes] Could not read %s/%s: %s", bucket, object_key, exc)
        return None


def write_json(bucket: str, object_key: str, data: dict) -> int:
    minio = get_minio_client()
    raw = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    minio.put_object(
        bucket_name=bucket,
        object_name=object_key,
        data=io.BytesIO(raw),
        length=len(raw),
        content_type="application/json",
    )
    return len(raw)


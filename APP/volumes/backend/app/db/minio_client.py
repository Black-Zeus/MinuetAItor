# db/minio_client.py
"""
Cliente MinIO singleton.
Configuración desde settings (core/config.py).

Uso:
    from db.minio_client import get_minio_client
    minio = get_minio_client()
    minio.put_object(...)
"""
from __future__ import annotations

import logging
from functools import lru_cache

from minio import Minio

from core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_minio_client() -> Minio:
    """
    Retorna un cliente MinIO singleton.
    lru_cache garantiza que solo se crea una instancia por proceso.
    """
    client = Minio(
        endpoint   = f"{settings.minio_host}:{settings.minio_port}",
        access_key = settings.minio_root_user,
        secret_key = settings.minio_root_password,
        secure     = False,   # True en producción con TLS
    )
    logger.info(f"[minio] Cliente inicializado → {settings.minio_host}:{settings.minio_port}")
    _ensure_buckets(client)
    return client


def _ensure_buckets(client: Minio) -> None:
    """
    Verifica que los buckets del sistema existan en MinIO.
    Los crea si no existen (útil en first-run de desarrollo).
    """
    required = [
        "minuetaitor-inputs",
        "minuetaitor-json",
        "minuetaitor-published",
        "minuetaitor-attach",
    ]
    for bucket in required:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
            logger.info(f"[minio] Bucket creado: {bucket}")
        else:
            logger.debug(f"[minio] Bucket OK: {bucket}")
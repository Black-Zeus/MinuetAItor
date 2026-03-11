# core/minio_client.py
from minio import Minio
from core.config import settings

_minio = None

def get_minio() -> Minio:
    global _minio
    if _minio is None:
        _minio = Minio(
            f"{settings.MINIO_HOST}:{settings.MINIO_PORT}",
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=False,
        )
    return _minio
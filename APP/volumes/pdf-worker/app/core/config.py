# core/config.py
from pathlib import Path

from pydantic_settings import BaseSettings


def _read_secret_file(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8").strip()
    except OSError:
        return ""

class Settings(BaseSettings):
    REDIS_HOST:       str   = "redis"
    REDIS_PORT:       int   = 6379
    MINIO_HOST:       str   = "minio"
    MINIO_PORT:       int   = 9000
    MINIO_ACCESS_KEY: str   = "minioadmin"
    MINIO_SECRET_KEY: str   = ""
    MINIO_SECRET_KEY_FILE: str = ""
    GOTENBERG_URL:    str   = "http://gotenberg:3000"
    BACKEND_INTERNAL_URL: str = "http://minuetaitor-backend:8000"
    INTERNAL_API_SECRET: str = "-"
    INTERNAL_API_SECRET_FILE: str = ""
    BACKEND_TIMEOUT: int = 30
    MAX_CONCURRENT_JOBS: int = 3
    MAX_RETRIES:      int   = 3
    RETRY_BACKOFF_BASE: float = 2.0
    BLPOP_TIMEOUT:    int   = 5
    LOG_LEVEL:        str   = "INFO"

    def model_post_init(self, __context) -> None:
        if self.MINIO_SECRET_KEY_FILE:
            self.MINIO_SECRET_KEY = _read_secret_file(self.MINIO_SECRET_KEY_FILE) or self.MINIO_SECRET_KEY
        if self.INTERNAL_API_SECRET_FILE:
            self.INTERNAL_API_SECRET = _read_secret_file(self.INTERNAL_API_SECRET_FILE) or self.INTERNAL_API_SECRET

    class Config:
        env_file = ".env"

settings = Settings()

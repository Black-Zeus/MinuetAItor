# core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    REDIS_HOST:       str   = "redis"
    REDIS_PORT:       int   = 6379
    MINIO_HOST:       str   = "minio"
    MINIO_PORT:       int   = 9000
    MINIO_ACCESS_KEY: str   = "minioadmin"
    MINIO_SECRET_KEY: str   = "minioadmin"
    GOTENBERG_URL:    str   = "http://gotenberg:3000"
    MAX_CONCURRENT_JOBS: int = 3
    MAX_RETRIES:      int   = 3
    RETRY_BACKOFF_BASE: float = 2.0
    BLPOP_TIMEOUT:    int   = 5
    LOG_LEVEL:        str   = "INFO"

    class Config:
        env_file = ".env"

settings = Settings()
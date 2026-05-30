from pathlib import Path

from pydantic_settings import BaseSettings


def _read_secret_file(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8").strip()
    except OSError:
        return ""

class Settings(BaseSettings):
    env_name: str = "dev"
    app_version: str = ""

    geo_db_path: str = "/app/assets/dbGeo/dbip-city-lite.mmdb"
    
    # DB
    mariadb_host: str
    mariadb_port: int = 3306
    mariadb_database: str
    mariadb_user: str
    mariadb_password: str = ""
    mariadb_password_file: str = ""
    
    # Redis
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_socket_connect_timeout: int = 5
    redis_socket_timeout: int = 10

    # DB connection safety
    mariadb_connect_timeout: int = 5
    mariadb_read_timeout: int = 15
    mariadb_write_timeout: int = 15
    
    # JWT
    jwt_secret: str = ""
    jwt_secret_file: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    
    # Internal API — autenticación entre servicios Docker (worker → backend)
    internal_api_secret: str = "-"
    internal_api_secret_file: str = ""
    allow_private_provider_hosts: bool = False
    cors_allowed_origins: list[str] = []

    # Geo
    geo_db_path: str = "/app/assets/dbGeo/dbip-city-lite.mmdb"
    geo_block_enabled: bool = True 
    geo_allowed_countries: list[str] = ["CL"]

    # IA legacy / compatibilidad mínima.
    # Solo mantenemos OPENAI_API_KEY por helpers antiguos y OPENAI_SYSTEM_PROMPT
    # para el pipeline actual de minutas.
    openai_api_key: str = ""
    openai_system_prompt: str = "system_prompt_v08.txt"
    prompt_path_base: str = "/app/assets/prompts"
    ai_provider_catalog_path: str = "/app/assets/config/ai_provider_catalog.json"

    # Minutes — formatos de archivo soportados
    minutes_supported_extensions: dict[str, str] = {
        ".txt":  "text/plain",
        ".text": "text/plain",
        ".pdf":  "application/pdf",
    }
    minutes_supported_mimes: dict[str, str] = {
        "text/plain":      "text/plain",
        "application/pdf": "application/pdf",
    }

    # MinIO
    minio_host:          str = "minio"
    minio_port:          int = 9000
    minio_root_user:     str = "minioadmin"
    minio_root_password: str = ""
    minio_root_password_file: str = ""
    maintenance_state_file: str = "/app/maintenance_state.json"

    # Minutes config
    minutes_max_file_size_mb: int = 50
    minutes_max_files_per_request: int = 10
    minutes_rate_limit_per_day: int = 20
    minutes_polling_interval_seconds: int = 3
    minutes_max_polling_attempts: int = 100
    minutes_stale_processing_minutes: int = 10

    # Redis TTLs
    redis_ttl_file_id_days: int = 30
    redis_ttl_transaction_hours: int = 24
    redis_ttl_lock_seconds: int = 30

    # Worker coordination
    worker_max_retries: int = 3

    def model_post_init(self, __context) -> None:
        if self.mariadb_password_file:
            self.mariadb_password = _read_secret_file(self.mariadb_password_file) or self.mariadb_password
        if self.jwt_secret_file:
            self.jwt_secret = _read_secret_file(self.jwt_secret_file) or self.jwt_secret
        if self.internal_api_secret_file:
            self.internal_api_secret = _read_secret_file(self.internal_api_secret_file) or self.internal_api_secret
        if self.minio_root_password_file:
            self.minio_root_password = _read_secret_file(self.minio_root_password_file) or self.minio_root_password

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.mariadb_user}:{self.mariadb_password}"
            f"@{self.mariadb_host}:{self.mariadb_port}/{self.mariadb_database}"
        )

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

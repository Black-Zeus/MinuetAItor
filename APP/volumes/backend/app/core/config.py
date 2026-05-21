from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    env_name: str = "dev"

    geo_db_path: str = "/app/assets/dbGeo/dbip-city-lite.mmdb"
    
    # DB
    mariadb_host: str
    mariadb_port: int = 3306
    mariadb_database: str
    mariadb_user: str
    mariadb_password: str
    
    # Redis
    redis_host: str = "redis"
    redis_port: int = 6379
    
    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    
    # Internal API — autenticación entre servicios Docker (worker → backend)
    internal_api_secret: str = "-"

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

    # Minutes config
    minutes_max_file_size_mb: int = 50
    minutes_max_files_per_request: int = 10
    minutes_rate_limit_per_day: int = 20
    minutes_polling_interval_seconds: int = 3
    minutes_max_polling_attempts: int = 100

    # Redis TTLs
    redis_ttl_file_id_days: int = 30
    redis_ttl_transaction_hours: int = 24
    redis_ttl_lock_seconds: int = 30

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

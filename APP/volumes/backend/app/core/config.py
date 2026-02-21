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

    # Geo
    geo_db_path: str = "/app/assets/dbGeo/dbip-city-lite.mmdb"
    geo_block_enabled: bool = True 
    geo_allowed_countries: list[str] = ["CL"]

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
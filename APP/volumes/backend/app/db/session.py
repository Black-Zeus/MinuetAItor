from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={
        "connect_timeout": settings.mariadb_connect_timeout,
        "read_timeout": settings.mariadb_read_timeout,
        "write_timeout": settings.mariadb_write_timeout,
    },
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

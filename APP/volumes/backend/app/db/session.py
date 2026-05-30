from datetime import datetime

from sqlalchemy import DateTime, create_engine
from sqlalchemy import event
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session, sessionmaker
from core.config import settings
from core.datetime_utils import assume_utc

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={
        "connect_timeout": settings.mariadb_connect_timeout,
        "read_timeout": settings.mariadb_read_timeout,
        "write_timeout": settings.mariadb_write_timeout,
    },
)


@event.listens_for(engine, "connect")
def set_utc_timezone(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("SET time_zone = '+00:00'")
    finally:
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@event.listens_for(Session, "before_flush")
def normalize_datetime_columns_to_utc(session, flush_context, instances):
    for obj in list(session.new) + list(session.dirty):
        try:
            mapper = sa_inspect(obj).mapper
        except Exception:
            continue

        for prop in mapper.column_attrs:
            column = prop.columns[0] if prop.columns else None
            if column is None or not isinstance(column.type, DateTime):
                continue
            value = getattr(obj, prop.key, None)
            if not isinstance(value, datetime) or value.tzinfo is None:
                continue
            setattr(obj, prop.key, assume_utc(value).replace(tzinfo=None))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

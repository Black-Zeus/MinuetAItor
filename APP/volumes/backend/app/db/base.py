# db/base.py
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, DateTime
from core.datetime_utils import utc_now_db


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    """
    Mixin reutilizable para auditoría de fechas.

    Convención:
    - Persistencia BD: UTC naive
    - Presentación/logs operativos: hora local Santiago
    """
    created_at = Column(DateTime, default=utc_now_db, nullable=False)
    updated_at = Column(DateTime, default=utc_now_db, onupdate=utc_now_db, nullable=False)

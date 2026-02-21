# models/user_sessions.py
from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from db.base import Base


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    jti = Column(String(36), nullable=False, unique=True)

    ip_v4 = Column(String(45), nullable=True)
    ip_v6 = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    device = Column(String(200), nullable=True)

    country_code = Column(String(2), nullable=True)
    country_name = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    location = Column(String(200), nullable=True)

    logged_out_at = Column(DateTime, nullable=True)

    # created_at existe en SQL (no usar TimestampMixin aquí por regla del proyecto)
    created_at = Column(DateTime, nullable=False)

    # Relaciones
    user = relationship("User", lazy="select")

    def __repr__(self) -> str:
        return f"<UserSession id={self.id} user_id={self.user_id} jti={self.jti}>"
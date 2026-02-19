# models/user_session.py
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from db.base import Base


class UserSession(Base):
    __tablename__ = "user_sessions"

    id            = Column(String(36), primary_key=True)
    user_id       = Column(String(36), ForeignKey("users.id"), nullable=False)
    jti           = Column(String(36), nullable=False, unique=True)

    ip_v4         = Column(String(45), nullable=True)
    ip_v6         = Column(String(45), nullable=True)
    user_agent    = Column(String(500), nullable=True)
    device        = Column(String(200), nullable=True)

    country_code  = Column(String(2), nullable=True)
    country_name  = Column(String(100), nullable=True)
    city          = Column(String(100), nullable=True)
    location      = Column(String(200), nullable=True)

    logged_out_at = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
# models/user.py
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id            = Column(String(36), primary_key=True)
    username      = Column(String(80), nullable=False, unique=True)
    email         = Column(String(200), nullable=True, unique=True)
    password_hash = Column(String(255), nullable=False)
    full_name     = Column(String(200), nullable=True)
    description   = Column(String(500), nullable=True)
    phone         = Column(String(20), nullable=True)
    area          = Column(String(80), nullable=True)
    job_title     = Column(String(250), nullable=True)
    is_active     = Column(Boolean, nullable=False, default=True)
    last_login_at = Column(DateTime, nullable=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────────
    roles = relationship(
        "UserRole",
        foreign_keys="[UserRole.user_id]",
        back_populates="user",
        lazy="select",
    )

    # CORRECCIÓN: eliminar declaración duplicada de profile
    profile = relationship(
        "UserProfile",
        foreign_keys="[UserProfile.user_id]",
        back_populates="user",
        uselist=False,
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r} active={bool(self.is_active)}>"
# models/projects.py
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True)

    client_id = Column(String(36), ForeignKey("clients.id"), nullable=False)

    name = Column(String(220), nullable=False)
    code = Column(String(50), nullable=True)
    description = Column(String(900), nullable=True)
    status = Column(String(40), nullable=False, default="activo")

    is_confidential = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────────
    client = relationship("Client", lazy="select")

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return f"<Project id={self.id} client_id={self.client_id} name={self.name!r} active={self.is_active}>"

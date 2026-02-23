# models/clients.py
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class Client(Base, TimestampMixin):
    __tablename__ = "clients"

    id = Column(String(36), primary_key=True)

    # ── Identidad empresa ─────────────────────────────────────────────────────
    name       = Column(String(200), nullable=False)
    legal_name = Column(String(200), nullable=True)
    description = Column(String(600), nullable=True)
    industry   = Column(String(120), nullable=True)

    # ── Contacto empresa ──────────────────────────────────────────────────────
    email   = Column(String(254), nullable=True)
    phone   = Column(String(30),  nullable=True)
    website = Column(String(500), nullable=True)
    address = Column(String(400), nullable=True)

    # ── Contacto persona ──────────────────────────────────────────────────────
    contact_name       = Column(String(200), nullable=True)
    contact_email      = Column(String(254), nullable=True)
    contact_phone      = Column(String(30),  nullable=True)
    contact_position   = Column(String(120), nullable=True)
    contact_department = Column(String(120), nullable=True)

    # ── Clasificación ─────────────────────────────────────────────────────────
    status   = Column(String(20), nullable=True, default="activo")
    priority = Column(String(20), nullable=True, default="media")

    # ── Contenido libre ───────────────────────────────────────────────────────
    notes = Column(Text,        nullable=True)
    tags  = Column(String(500), nullable=True)

    # ── Gobernanza ────────────────────────────────────────────────────────────
    is_confidential = Column(Boolean, nullable=False, default=False)
    is_active       = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime,   nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return f"<Client id={self.id} name={self.name!r} active={self.is_active}>"
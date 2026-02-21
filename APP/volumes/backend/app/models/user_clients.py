# models/user_clients.py
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func
from sqlalchemy.orm import relationship

from db.base import Base


class UserClient(Base):
    """
    Asignación básica usuario-cliente.
    No usa TimestampMixin porque updated_at es opcional en tablas pivote
    y se gestiona manualmente para consistencia con el SQL.
    """
    __tablename__ = "user_clients"

    user_id   = Column(String(36), ForeignKey("users.id"), primary_key=True)
    client_id = Column(String(36), ForeignKey("clients.id"), primary_key=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    updated_at = Column(DateTime, nullable=True, onupdate=lambda: datetime.now(timezone.utc))
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Relaciones de dominio
    user   = relationship("User",   foreign_keys=[user_id],   lazy="select")
    client = relationship("Client", foreign_keys=[client_id], lazy="select")

    # Relaciones de auditoría
    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return f"<UserClient user_id={self.user_id} client_id={self.client_id} active={bool(self.is_active)}>"
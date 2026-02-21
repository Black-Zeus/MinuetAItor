# models/user_clients.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func
from sqlalchemy.orm import relationship

from db.base import Base


class UserClient(Base):
    __tablename__ = "user_clients"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    client_id = Column(String(36), ForeignKey("clients.id"), primary_key=True)

    is_active = Column(Boolean, nullable=False, default=True, server_default="1")

    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    updated_at = Column(DateTime, nullable=True, server_onupdate=func.current_timestamp())
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Relaciones (joinedload en service)
    user = relationship("User", foreign_keys=[user_id], lazy="select")
    client = relationship("Client", foreign_keys=[client_id], lazy="select")

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return f"<UserClient user_id={self.user_id} client_id={self.client_id} active={bool(self.is_active)}>"
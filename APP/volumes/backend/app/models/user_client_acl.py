# models/user_client_acl.py
from __future__ import annotations

import enum
from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Index, String, func
from sqlalchemy.orm import relationship

from db.base import Base


class UserClientAclPermission(str, enum.Enum):
    read = "read"
    edit = "edit"
    owner = "owner"


class UserClientAcl(Base):
    __tablename__ = "user_client_acl"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    client_id = Column(String(36), ForeignKey("clients.id"), primary_key=True)

    permission = Column(
        Enum(UserClientAclPermission, name="uca_permission_enum"),
        nullable=False,
        server_default=UserClientAclPermission.read.value,
    )
    is_active = Column(Boolean, nullable=False, server_default="1")

    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Relaciones de dominio
    user = relationship("User", foreign_keys=[user_id], lazy="select")
    client = relationship("Client", foreign_keys=[client_id], lazy="select")

    # Relaciones auditoría
    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    __table_args__ = (
        Index("idx_uca_permission", "permission"),
        Index("idx_uca_active", "is_active"),
        Index("idx_uca_deleted_at", "deleted_at"),
    )

    def __repr__(self) -> str:
        return f"<UserClientAcl user_id={self.user_id} client_id={self.client_id} permission={self.permission} active={self.is_active}>"
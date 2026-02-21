# models/roles.py
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    # CORRECCIÓN: Integer estándar (agnóstico de BD).
    id = Column(Integer, primary_key=True, autoincrement=True)

    code        = Column(String(50), nullable=False, unique=True)
    name        = Column(String(120), nullable=False)
    description = Column(String(255), nullable=True)
    is_active   = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Auditoría
    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    # Asociaciones
    permissions = relationship(
        "RolePermission",
        foreign_keys="[RolePermission.role_id]",
        back_populates="role",
        lazy="select",
    )
    user_roles = relationship(
        "UserRole",
        foreign_keys="[UserRole.role_id]",
        back_populates="role",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Role id={self.id} code={self.code!r} active={bool(self.is_active)}>"
# models/permissions.py
from __future__ import annotations

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin


class Permission(Base, TimestampMixin):
    __tablename__ = "permissions"

    # CORRECCIÓN: Integer estándar (agnóstico de BD).
    # En MariaDB/MySQL el autoincrement con Integer se mapea a INT.
    # Si se requiere SMALLINT, ajustar en una migración Alembic sin cambiar el modelo.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    code: Mapped[str]        = mapped_column(String(100), nullable=False, unique=True, index=True)
    name: Mapped[str]        = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool]  = mapped_column(Boolean, nullable=False, default=True)

    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)
    deleted_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    # Relaciones de auditoría
    created_by_user = relationship("User", foreign_keys=[created_by], viewonly=True, lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], viewonly=True, lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], viewonly=True, lazy="select")

    def __repr__(self) -> str:
        return f"<Permission id={self.id} code={self.code!r} active={bool(self.is_active)}>"
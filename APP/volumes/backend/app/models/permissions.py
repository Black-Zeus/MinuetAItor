# models/permission.py
from __future__ import annotations

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import and_
from sqlalchemy.orm import foreign

from db.base import Base, TimestampMixin


class Permission(Base, TimestampMixin):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(36), nullable=True)

    deleted_at: Mapped["DateTime | None"] = mapped_column(DateTime, nullable=True)
    deleted_by: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # Relaciones de auditoría (sin FK explícita en SQL; se resuelve por join manual)
    created_by_user = relationship(
        "User",
        primaryjoin=lambda: and_(
            foreign(Permission.created_by) == User.id,
        ),
        viewonly=True,
        lazy="select",
    )
    updated_by_user = relationship(
        "User",
        primaryjoin=lambda: and_(
            foreign(Permission.updated_by) == User.id,
        ),
        viewonly=True,
        lazy="select",
    )
    deleted_by_user = relationship(
        "User",
        primaryjoin=lambda: and_(
            foreign(Permission.deleted_by) == User.id,
        ),
        viewonly=True,
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Permission id={self.id} code={self.code!r} active={bool(self.is_active)}>"


# Import diferido para evitar ciclos en tiempo de import
from models.user import User  # noqa: E402
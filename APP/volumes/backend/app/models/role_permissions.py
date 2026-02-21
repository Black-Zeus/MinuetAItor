# models/role_permissions.py
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.mysql import SMALLINT, INTEGER  # ✅

from db.base import Base


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(
        SMALLINT(unsigned=True),  # ✅
        ForeignKey("roles.id"),
        primary_key=True,
    )
    permission_id: Mapped[int] = mapped_column(
        INTEGER(unsigned=True),   # ✅
        ForeignKey("permissions.id"),
        primary_key=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    created_by: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    role = relationship("Role", lazy="select")
    permission = relationship("Permission", lazy="select")

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")
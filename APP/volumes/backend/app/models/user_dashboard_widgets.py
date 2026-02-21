# models/user_dashboard_widgets.py
from __future__ import annotations

from sqlalchemy import Boolean, DateTime, ForeignKey, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin


class UserDashboardWidget(Base, TimestampMixin):
    __tablename__ = "user_dashboard_widgets"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        primary_key=True,
    )
    widget_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("dashboard_widgets.id"),
        primary_key=True,
    )

    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at: Mapped[object | None] = mapped_column(DateTime, nullable=True)
    deleted_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    # Relaciones principales
    user = relationship("User", foreign_keys=[user_id], lazy="select")
    widget = relationship("DashboardWidget", foreign_keys=[widget_id], lazy="select")

    # Auditoría
    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return f"<UserDashboardWidget user_id={self.user_id} widget_id={self.widget_id} enabled={self.enabled}>"
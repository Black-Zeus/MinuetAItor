# models/user_notification_preferences.py
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String

from db.base import Base


class UserNotificationPreference(Base):
    __tablename__ = "user_notification_preferences"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    preference_key = Column(String(80), primary_key=True)
    is_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<UserNotificationPreference user_id={self.user_id!r} "
            f"preference_key={self.preference_key!r} is_enabled={bool(self.is_enabled)!r}>"
        )

# models/notifications.py
from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from db.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True)
    notification_type = Column(String(80), nullable=False)
    level = Column(String(20), nullable=False, default="info")
    title = Column(String(200), nullable=False)
    message = Column(String(2000), nullable=False)
    tags_json = Column(Text, nullable=True)
    scope_type = Column(String(80), nullable=True)
    scope_id = Column(String(64), nullable=True)
    action_url = Column(String(255), nullable=True)
    actor_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False)

    actor_user = relationship("User", foreign_keys=[actor_user_id], lazy="select")
    recipients = relationship(
        "NotificationRecipient",
        foreign_keys="[NotificationRecipient.notification_id]",
        back_populates="notification",
        lazy="select",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Notification id={self.id} type={self.notification_type!r} level={self.level!r}>"

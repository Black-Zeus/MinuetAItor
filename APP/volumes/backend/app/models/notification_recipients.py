# models/notification_recipients.py
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from db.base import Base


class NotificationRecipient(Base):
    __tablename__ = "notification_recipients"

    id = Column(String(36), primary_key=True)
    notification_id = Column(String(36), ForeignKey("notifications.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    read_at = Column(DateTime, nullable=True)
    is_hidden = Column(Boolean, nullable=False, default=False)
    hidden_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False)

    notification = relationship("Notification", foreign_keys=[notification_id], back_populates="recipients", lazy="select")
    user = relationship("User", foreign_keys=[user_id], lazy="select")

    def __repr__(self) -> str:
        return (
            f"<NotificationRecipient id={self.id} notification_id={self.notification_id} "
            f"user_id={self.user_id} read={bool(self.is_read)} hidden={bool(self.is_hidden)}>"
        )

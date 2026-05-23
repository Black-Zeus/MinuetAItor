from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from db.base import Base


class EmailDeliveryEvent(Base):
    __tablename__ = "email_delivery_events"

    id = Column(String(36), primary_key=True)
    job_id = Column(String(36), nullable=False, unique=True)
    queue_name = Column(String(80), nullable=False, default="queue:email")
    status = Column(String(30), nullable=False)
    email_kind = Column(String(80), nullable=False, default="system")
    notification_type = Column(String(80), nullable=True)
    template_id = Column(String(120), nullable=True)
    subject = Column(String(300), nullable=False)
    email_type = Column(String(20), nullable=False, default="html")
    to_json = Column(Text, nullable=True)
    cc_json = Column(Text, nullable=True)
    bcc_json = Column(Text, nullable=True)
    recipient_count = Column(Integer, nullable=False, default=0)
    attachment_count = Column(Integer, nullable=False, default=0)
    inline_asset_count = Column(Integer, nullable=False, default=0)
    scope_type = Column(String(80), nullable=True)
    scope_id = Column(String(64), nullable=True)
    record_id = Column(String(36), ForeignKey("records.id"), nullable=True)
    actor_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    tags_json = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    attempt = Column(Integer, nullable=False, default=1)
    error_message = Column(Text, nullable=True)
    queued_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    event_at = Column(DateTime, nullable=False, server_default=func.now())
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=True, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<EmailDeliveryEvent id={self.id} job_id={self.job_id} status={self.status!r}>"

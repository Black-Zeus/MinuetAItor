from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, SmallInteger, String, func
from sqlalchemy.dialects.mysql import BIGINT
from sqlalchemy.orm import relationship

from db.base import Base


class VisitorAccessRequest(Base):
    __tablename__ = "visitor_access_requests"

    id = Column(String(36), primary_key=True)
    record_id = Column(String(36), ForeignKey("records.id"), nullable=False)
    record_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=True)
    record_version_participant_id = Column(BIGINT(unsigned=True), ForeignKey("record_version_participants.id"), nullable=True)
    email = Column(String(200), nullable=False)
    otp_code_hash = Column(String(64), nullable=False)
    otp_expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    attempt_count = Column(SmallInteger, nullable=False, default=0)
    last_attempt_at = Column(DateTime, nullable=True)
    requester_ip = Column(String(45), nullable=True)
    requester_user_agent = Column(String(500), nullable=True)
    delivery_status = Column(String(30), nullable=False, default="pending")
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    record = relationship("Record", lazy="select")
    record_version = relationship("RecordVersion", lazy="select")
    record_version_participant = relationship("RecordVersionParticipant", lazy="select")

    def __repr__(self) -> str:
        return f"<VisitorAccessRequest id={self.id} record_id={self.record_id} email={self.email!r}>"

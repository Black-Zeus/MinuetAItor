from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.mysql import BIGINT
from sqlalchemy.orm import relationship

from db.base import Base


class RecordVersionObservation(Base):
    __tablename__ = "record_version_observations"

    id = Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    record_id = Column(String(36), ForeignKey("records.id"), nullable=False)
    record_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=False)
    record_version_participant_id = Column(BIGINT(unsigned=True), ForeignKey("record_version_participants.id"), nullable=True)
    visitor_session_id = Column(String(36), ForeignKey("visitor_sessions.id"), nullable=True)
    author_email = Column(String(200), nullable=False)
    author_name = Column(String(220), nullable=True)
    body = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="new")
    resolution_type = Column(String(20), nullable=False, default="none")
    editor_comment = Column(Text, nullable=True)
    resolved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    resolution_note = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    applied_in_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=True)
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime,
        nullable=True,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    record = relationship("Record", lazy="select")
    record_version = relationship("RecordVersion", foreign_keys=[record_version_id], lazy="select")
    record_version_participant = relationship("RecordVersionParticipant", lazy="select")
    visitor_session = relationship("VisitorSession", lazy="select")
    resolved_by_user = relationship("User", foreign_keys=[resolved_by], lazy="select")
    applied_in_version = relationship("RecordVersion", foreign_keys=[applied_in_version_id], lazy="select")

    def __repr__(self) -> str:
        return f"<RecordVersionObservation id={self.id} record_version_id={self.record_version_id}>"

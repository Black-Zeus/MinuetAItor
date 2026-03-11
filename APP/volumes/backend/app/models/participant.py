# models/participant.py
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class Participant(Base, TimestampMixin):
    __tablename__ = "participants"

    id              = Column(String(36), primary_key=True)
    display_name    = Column(String(220), nullable=False)
    normalized_name = Column(String(220), nullable=False)
    organization    = Column(String(220), nullable=True)
    title           = Column(String(160), nullable=True)
    notes           = Column(Text, nullable=True)
    is_active       = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    emails = relationship(
        "ParticipantEmail",
        foreign_keys="[ParticipantEmail.participant_id]",
        back_populates="participant",
        lazy="select",
        cascade="all, delete-orphan",
    )

    record_version_participants = relationship(
        "RecordVersionParticipant",
        foreign_keys="[RecordVersionParticipant.participant_id]",
        back_populates="participant",
        lazy="select",
    )

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return f"<Participant id={self.id} display_name={self.display_name!r} active={bool(self.is_active)}>"

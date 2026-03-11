# models/participant_email.py
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.mysql import BIGINT
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class ParticipantEmail(Base, TimestampMixin):
    __tablename__ = "participant_emails"

    id             = Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    participant_id = Column(String(36), ForeignKey("participants.id"), nullable=False)
    email          = Column(String(254), nullable=False, unique=True)
    is_primary     = Column(Boolean, nullable=False, default=False)
    is_active      = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    participant = relationship("Participant", foreign_keys=[participant_id], back_populates="emails", lazy="select")

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return f"<ParticipantEmail id={self.id} participant_id={self.participant_id} email={self.email!r}>"

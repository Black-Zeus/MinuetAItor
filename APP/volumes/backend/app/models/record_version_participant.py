# models/record_version_participant.py

from __future__ import annotations

import enum

from sqlalchemy import Column, Enum, ForeignKey, String
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.mysql import BIGINT

from db.base import Base, TimestampMixin


class RecordVersionParticipantRole(str, enum.Enum):
    required = "required"
    optional = "optional"
    observer = "observer"
    unknown = "unknown"


class RecordVersionParticipant(Base, TimestampMixin):
    __tablename__ = "record_version_participants"

    id = Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)

    record_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=False)

    role = Column(
        Enum(RecordVersionParticipantRole, name="record_version_participant_role"),
        nullable=False,
        default=RecordVersionParticipantRole.unknown,
    )

    display_name = Column(String(220), nullable=False)
    organization = Column(String(220), nullable=True)
    title = Column(String(160), nullable=True)
    email = Column(String(200), nullable=True)

    record_version = relationship("RecordVersion", lazy="select", back_populates="participants")

    def __repr__(self) -> str:
        return f"<RecordVersionParticipant id={self.id} record_version_id={self.record_version_id} display_name={self.display_name!r}>"
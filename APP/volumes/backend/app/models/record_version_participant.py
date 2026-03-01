# models/record_version_participant.py
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.mysql import BIGINT
from sqlalchemy.orm import relationship

from db.base import Base


class RecordVersionParticipantRole(str, enum.Enum):
    required = "required"
    optional = "optional"
    observer = "observer"
    unknown  = "unknown"


class RecordVersionParticipant(Base):
    """
    Participante scoped a una versión específica.

    SIN TimestampMixin: la tabla record_version_participants en el DDL
    solo tiene created_at. No hay updated_at ni deleted_at — los
    participantes son inmutables junto con la versión.
    """
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
    title        = Column(String(160), nullable=True)
    email        = Column(String(200), nullable=True)

    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    record_version = relationship("RecordVersion", lazy="select", back_populates="participants")

    def __repr__(self) -> str:
        return (
            f"<RecordVersionParticipant id={self.id} "
            f"record_version_id={self.record_version_id} "
            f"display_name={self.display_name!r}>"
        )
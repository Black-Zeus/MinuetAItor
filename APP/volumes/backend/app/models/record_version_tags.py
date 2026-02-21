# models/record_version_tags.py

from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.orm import relationship

from db.base import Base


class RecordVersionTag(Base):
    __tablename__ = "record_version_tags"

    record_version_id = Column(
        String(36),
        ForeignKey("record_versions.id"),
        primary_key=True,
        nullable=False,
    )
    tag_id = Column(
        String(36),
        ForeignKey("tags.id"),
        primary_key=True,
        nullable=False,
    )

    added_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )
    added_by = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relaciones
    record_version = relationship("RecordVersion", lazy="select")
    tag = relationship("Tag", lazy="select")
    added_by_user = relationship("User", lazy="select")

    def __repr__(self) -> str:
        return (
            f"<RecordVersionTag(record_version_id={self.record_version_id}, "
            f"tag_id={self.tag_id})>"
        )
# models/record_version_ai_tags.py
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class RecordVersionAiTag(Base):
    __tablename__ = "record_version_ai_tags"

    record_version_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("record_versions.id"),
        primary_key=True,
    )
    ai_tag_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("ai_tags.id"),
        primary_key=True,
    )

    detected_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Relaciones (FK targets deben existir en tu proyecto)
    record_version = relationship("RecordVersion", lazy="select")
    ai_tag = relationship("AITag", lazy="select")

    def __repr__(self) -> str:
        return (
            f"<RecordVersionAiTag record_version_id={self.record_version_id} "
            f"ai_tag_id={self.ai_tag_id}>"
        )
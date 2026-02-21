# models/ai_tag_conversions.py

from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.orm import relationship

from db.base import Base


class AiTagConversion(Base):
    __tablename__ = "ai_tag_conversions"

    ai_tag_id = Column(String(36), ForeignKey("ai_tags.id"), primary_key=True)
    tag_id    = Column(String(36), ForeignKey("tags.id"), primary_key=True)

    converted_at = Column(DateTime, nullable=False, server_default=func.now())
    converted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    #ai_tag = relationship("AITag", lazy="select")
    ai_tag = relationship("AITag", lazy="select")   # mayúsculas correctas

    tag    = relationship("Tag", lazy="select")

    converted_by_user = relationship(
        "User",
        lazy="select",
        foreign_keys=[converted_by],
    )

    def __repr__(self) -> str:
        return f"<AiTagConversion ai_tag_id={self.ai_tag_id} tag_id={self.tag_id}>"
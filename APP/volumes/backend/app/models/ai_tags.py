# models/ai_tags.py
import uuid

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class AITag(Base):
    __tablename__ = "ai_tags"

    id = Column(String(36), primary_key=True)

    slug = Column(String(180), nullable=False, unique=True)
    description = Column(String(900), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False)

    def __repr__(self) -> str:
        return f"<AITag id={self.id} slug={self.slug!r} active={self.is_active}>"

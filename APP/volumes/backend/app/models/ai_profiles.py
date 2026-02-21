# models/ai_profiles.py
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, SmallInteger
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class AiProfile(Base, TimestampMixin):
    __tablename__ = "ai_profiles"

    id = Column(String(36), primary_key=True)

    category_id = Column(SmallInteger, ForeignKey("ai_profile_categories.id"), nullable=False)

    name = Column(String(180), nullable=False, unique=True)
    description = Column(String(900), nullable=True)
    prompt = Column(MEDIUMTEXT, nullable=False)

    is_active = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    category = relationship(
        "AiProfileCategory",
        lazy="select",
        foreign_keys=[category_id],
    )

    created_by_user = relationship(
        "User",
        lazy="select",
        foreign_keys=[created_by],
    )
    updated_by_user = relationship(
        "User",
        lazy="select",
        foreign_keys=[updated_by],
    )
    deleted_by_user = relationship(
        "User",
        lazy="select",
        foreign_keys=[deleted_by],
    )

    def __repr__(self) -> str:
        return f"<AiProfile id={self.id} name={self.name!r} category_id={self.category_id} active={bool(self.is_active)}>"

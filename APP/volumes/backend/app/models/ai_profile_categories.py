# models/ai_profile_categories.py
from __future__ import annotations

from sqlalchemy import Boolean, Column, SmallInteger, String
from db.base import Base, TimestampMixin  # TimestampMixin importado por convención (no se usa aquí)


class AiProfileCategory(Base):
    __tablename__ = "ai_profile_categories"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False, unique=True)
    is_active = Column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<AiProfileCategory id={self.id} name={self.name!r} is_active={bool(self.is_active)}>"

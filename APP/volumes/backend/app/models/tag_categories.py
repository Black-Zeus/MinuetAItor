# models/tag_categories.py

from sqlalchemy import Boolean, Column, SmallInteger, String
from db.base import Base, TimestampMixin


class TagCategory(Base):
    __tablename__ = "tag_categories"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False, unique=True)
    is_active = Column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<TagCategory id={self.id} name={self.name!r} is_active={self.is_active}>"

# models/tags.py
import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, SmallInteger, String
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class TagSourceEnum(str, enum.Enum):
    user = "user"
    ai = "ai"


class Tag(Base, TimestampMixin):
    __tablename__ = "tags"

    id = Column(String(36), primary_key=True)

    category_id = Column(SmallInteger, ForeignKey("tag_categories.id"), nullable=False)

    name = Column(String(140), nullable=False)
    description = Column(String(900), nullable=True)

    source = Column(
        Enum(TagSourceEnum, name="tag_source_enum"),
        nullable=False,
        default=TagSourceEnum.user,
    )

    status = Column(String(30), nullable=False, default="activo")
    is_active = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Relaciones
    category = relationship("TagCategory", lazy="select")

    created_by_user = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="select",
    )
    updated_by_user = relationship(
        "User",
        foreign_keys=[updated_by],
        lazy="select",
    )
    deleted_by_user = relationship(
        "User",
        foreign_keys=[deleted_by],
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Tag id={self.id} category_id={self.category_id} name={self.name!r} source={self.source} active={self.is_active}>"

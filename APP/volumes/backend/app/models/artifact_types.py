# models/artifact_types.py

from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, SmallInteger, String
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class ArtifactType(Base, TimestampMixin):
    __tablename__ = "artifact_types"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)

    code = Column(String(80), nullable=False, unique=True)
    name = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

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
        return f"<ArtifactType id={self.id} code={self.code!r} is_active={self.is_active}>"
# models/record_drafts.py

from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class RecordDraft(Base, TimestampMixin):
    __tablename__ = "record_drafts"

    record_id = Column(String(36), ForeignKey("records.id"), primary_key=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Relaciones
    record = relationship("Record", lazy="select")

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
        return f"<RecordDraft record_id={self.record_id}>"
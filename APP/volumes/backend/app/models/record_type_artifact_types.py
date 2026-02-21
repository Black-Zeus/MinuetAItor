# models/record_type_artifact_types.py

from __future__ import annotations

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin


class RecordTypeArtifactType(Base, TimestampMixin):
    __tablename__ = "record_type_artifact_types"

    record_type_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("record_types.id"), primary_key=True
    )
    artifact_type_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("artifact_types.id"), primary_key=True
    )

    is_required_on_publish: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    max_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    deleted_at: Mapped["DateTime | None"] = mapped_column(DateTime, nullable=True)
    deleted_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    # Relaciones
    record_type = relationship("RecordType", lazy="select")
    artifact_type = relationship("ArtifactType", lazy="select")

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return (
            f"<RecordTypeArtifactType(record_type_id={self.record_type_id}, "
            f"artifact_type_id={self.artifact_type_id}, is_active={self.is_active})>"
        )
# models/record_artifacts.py
from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
)
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class RecordArtifact(Base, TimestampMixin):
    __tablename__ = "record_artifacts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    record_id = Column(String(36), ForeignKey("records.id"), nullable=False)
    record_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=True)
    is_draft = Column(Boolean, nullable=False, default=False)

    artifact_type_id = Column(SmallInteger, ForeignKey("artifact_types.id"), nullable=False)
    artifact_state_id = Column(SmallInteger, ForeignKey("artifact_states.id"), nullable=False)

    object_id = Column(String(36), ForeignKey("objects.id"), nullable=False)
    natural_name = Column(String(300), nullable=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    record = relationship("Record", lazy="select")
    record_version = relationship("RecordVersion", lazy="select")

    artifact_type = relationship("ArtifactType", lazy="select")
    artifact_state = relationship("ArtifactState", lazy="select")

    object = relationship("Object", lazy="select")

    created_by_user = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="select",
    )
    deleted_by_user = relationship(
        "User",
        foreign_keys=[deleted_by],
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<RecordArtifact id={self.id} record_id={self.record_id} "
            f"type={self.artifact_type_id} state={self.artifact_state_id} draft={self.is_draft}>"
        )
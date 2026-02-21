# models/record_version_commits.py
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String, Text, UniqueConstraint, Index, func
from sqlalchemy.orm import relationship

from db.base import Base


class RecordVersionCommit(Base):
    """
    Commit de auditoría de versión. Es inmutable por naturaleza:
    solo tiene created_at, no updated_at.
    CORRECCIÓN: se reemplazó TimestampMixin (que agrega updated_at innecesariamente)
    por created_at manual.
    """
    __tablename__ = "record_version_commits"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    record_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=False)
    parent_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=True)

    commit_title  = Column(String(160), nullable=False)
    commit_body   = Column(Text, nullable=True)

    actor_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # Solo created_at — los commits no se modifican
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint("record_version_id", name="uq_rvc_one_per_version"),
        Index("idx_rvc_parent", "parent_version_id"),
        Index("idx_rvc_actor", "actor_user_id"),
        Index("idx_rvc_deleted_at", "deleted_at"),
    )

    # ── Relationships ─────────────────────────────────────────────────────
    record_version = relationship(
        "RecordVersion",
        foreign_keys=[record_version_id],
        lazy="select",
    )
    parent_version = relationship(
        "RecordVersion",
        foreign_keys=[parent_version_id],
        lazy="select",
    )
    actor_user = relationship(
        "User",
        foreign_keys=[actor_user_id],
        lazy="select",
    )
    deleted_by_user = relationship(
        "User",
        foreign_keys=[deleted_by],
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<RecordVersionCommit id={self.id} record_version_id={self.record_version_id}>"
# models/record_version_commits.py

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class RecordVersionCommit(Base, TimestampMixin):
    __tablename__ = "record_version_commits"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    record_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=False)
    parent_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=True)

    commit_title = Column(String(160), nullable=False)
    commit_body = Column(Text, nullable=True)

    actor_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

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
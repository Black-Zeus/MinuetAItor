# models/records.py

from __future__ import annotations

from sqlalchemy import Column, String, DateTime, Date, Time, ForeignKey
from sqlalchemy.orm import relationship

from sqlalchemy.dialects.mysql import SMALLINT, INTEGER

from db.base import Base, TimestampMixin


class Record(TimestampMixin, Base):
    __tablename__ = "records"

    id = Column(String(36), primary_key=True)

    client_id = Column(String(36), ForeignKey("clients.id"), nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=True)

    record_type_id = Column(SMALLINT(unsigned=True), ForeignKey("record_types.id"), nullable=False)
    status_id = Column(SMALLINT(unsigned=True), ForeignKey("record_statuses.id"), nullable=False)

    ai_profile_id = Column(String(36), ForeignKey("ai_profiles.id"), nullable=True)

    title = Column(String(300), nullable=False)
    document_date = Column(Date, nullable=True)
    location = Column(String(220), nullable=True)

    scheduled_start_time = Column(Time, nullable=True)
    scheduled_end_time = Column(Time, nullable=True)
    actual_start_time = Column(Time, nullable=True)
    actual_end_time = Column(Time, nullable=True)

    prepared_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    intro_snippet = Column(String(800), nullable=True)

    # No FK en el SQL entregado
    active_version_id = Column(String(36), nullable=True)
    latest_version_num = Column(INTEGER(unsigned=True), nullable=False, default=0)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────────
    client = relationship("Client", lazy="select")
    project = relationship("Project", lazy="select")

    record_type = relationship("RecordType", lazy="select")
    status = relationship("RecordStatus", lazy="select")

    ai_profile = relationship("AiProfile", lazy="select")

    prepared_by_user = relationship(
        "User",
        foreign_keys=[prepared_by_user_id],
        lazy="select",
    )

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
        return f"<Record id={self.id} title={self.title!r} status_id={self.status_id}>"
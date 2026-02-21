# models/record_versions.py
from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, SmallInteger, String, Text, func
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class RecordVersion(Base, TimestampMixin):
    __tablename__ = "record_versions"

    id = Column(String(36), primary_key=True)

    record_id   = Column(String(36), ForeignKey("records.id"), nullable=False)

    # CORRECCIÓN: Integer estándar (agnóstico de BD). Semánticamente es un número de versión
    # positivo, la restricción de unsigned se aplica a nivel de migración/BD si se desea.
    version_num = Column(Integer, nullable=False)

    # CORRECCIÓN: Integer estándar para FK a tabla de catálogo (version_statuses)
    status_id   = Column(Integer, ForeignKey("version_statuses.id"), nullable=False)

    published_at = Column(DateTime, nullable=False, server_default=func.now())
    published_by = Column(String(36), ForeignKey("users.id"), nullable=False)

    schema_version   = Column(String(40), nullable=False)
    template_version = Column(String(40), nullable=False)

    summary_text    = Column(Text, nullable=True)
    decisions_text  = Column(Text, nullable=True)
    agreements_text = Column(Text, nullable=True)
    risks_text      = Column(Text, nullable=True)
    next_steps_text = Column(Text, nullable=True)

    ai_provider = Column(String(40), nullable=True)
    ai_model    = Column(String(80), nullable=True)
    ai_run_id   = Column(String(80), nullable=True)

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    record = relationship("Record", lazy="select")
    status = relationship("VersionStatus", lazy="select")

    published_by_user = relationship(
        "User",
        foreign_keys=[published_by],
        lazy="select",
    )
    
    deleted_by_user = relationship(
        "User",
        foreign_keys=[deleted_by],
        lazy="select",
    )

    participants = relationship(
        "RecordVersionParticipant",
        lazy="select",
        back_populates="record_version",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<RecordVersion id={self.id} record_id={self.record_id} version_num={self.version_num}>"
# models/minute_transaction.py
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import relationship

from db.base import Base


class MinuteTransaction(Base):
    __tablename__ = "minute_transactions"

    id = Column(String(36), primary_key=True)

    record_id         = Column(String(36), ForeignKey("records.id"),         nullable=False)
    record_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=True)

    status = Column(
        Enum("pending", "processing", "completed", "failed", name="minute_tx_status"),
        nullable=False,
        default="pending",
    )

    # Punteros a objetos en MinIO (solo referencias)
    input_object_id  = Column(String(36), ForeignKey("objects.id"), nullable=True)
    output_object_id = Column(String(36), ForeignKey("objects.id"), nullable=True)

    # Auditoría OpenAI
    openai_thread_id = Column(String(100), nullable=True)
    openai_run_id    = Column(String(100), nullable=True)
    openai_model     = Column(String(80),  nullable=True)
    ai_profile_id    = Column(String(36),  ForeignKey("ai_profiles.id"), nullable=True)

    # sha256 → openai_file_id (archivos subidos a OpenAI, no son objetos MinIO)
    openai_file_ids = Column(JSON, nullable=True)

    error_message = Column(Text, nullable=True)

    requested_by = Column(String(36), ForeignKey("users.id"), nullable=False)

    created_at   = Column(DateTime, nullable=False,
                          default=lambda: datetime.now(timezone.utc),
                          server_default=func.now())
    updated_at   = Column(DateTime, nullable=True, onupdate=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────────
    record          = relationship("Record",        foreign_keys=[record_id],         lazy="select")
    record_version  = relationship("RecordVersion", foreign_keys=[record_version_id], lazy="select")
    input_object    = relationship("Object",        foreign_keys=[input_object_id],   lazy="select")
    output_object   = relationship("Object",        foreign_keys=[output_object_id],  lazy="select")
    ai_profile      = relationship("AiProfile",     foreign_keys=[ai_profile_id],     lazy="select")
    requested_by_user = relationship("User",        foreign_keys=[requested_by],      lazy="select")

    def __repr__(self) -> str:
        return (
            f"<MinuteTransaction id={self.id} "
            f"record_id={self.record_id} status={self.status}>"
        )
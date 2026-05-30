from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from db.base import Base


class SystemMaintenanceRun(Base):
    __tablename__ = "system_maintenance_runs"

    id = Column(String(36), primary_key=True)
    job_id = Column(String(36), nullable=False, unique=True)
    action = Column(String(80), nullable=False)
    scheduled_slot = Column(String(12), nullable=True)
    trigger_type = Column(String(30), nullable=False)
    status = Column(String(30), nullable=False, default="dispatch_pending")

    queued_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    duration_ms = Column(BigInteger, nullable=True)
    affected_count = Column(Integer, nullable=True)
    attempt = Column(Integer, nullable=False, default=1)
    max_attempts = Column(Integer, nullable=False, default=1)

    message = Column(String(700), nullable=True)
    error_code = Column(String(80), nullable=True)
    error_detail = Column(Text, nullable=True)
    requested_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    correlation_id = Column(String(36), nullable=False, unique=True)

    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=True)

    requested_by_user = relationship("User", foreign_keys=[requested_by], lazy="select")

    def __repr__(self) -> str:
        return f"<SystemMaintenanceRun id={self.id} action={self.action} status={self.status}>"

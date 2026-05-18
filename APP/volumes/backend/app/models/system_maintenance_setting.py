from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from db.base import Base


class SystemMaintenanceSetting(Base):
    __tablename__ = "system_maintenance_settings"

    id = Column(Integer, primary_key=True)

    session_cleanup_enabled = Column(Boolean, nullable=False, default=True)
    session_cleanup_cron = Column(String(40), nullable=False, default="0 * * * *")
    session_cleanup_mode = Column(String(40), nullable=False, default="soft_logout")

    temp_cleanup_enabled = Column(Boolean, nullable=False, default=True)
    temp_cleanup_cron = Column(String(40), nullable=False, default="0 3 * * *")
    temp_cleanup_max_age_days = Column(Integer, nullable=False, default=7)

    monitor_maintenance_queue_enabled = Column(Boolean, nullable=False, default=True)
    maintenance_queue_warning_threshold = Column(Integer, nullable=False, default=25)
    monitor_minutes_queue_enabled = Column(Boolean, nullable=False, default=True)
    minutes_queue_warning_threshold = Column(Integer, nullable=False, default=5)
    monitor_email_queue_enabled = Column(Boolean, nullable=False, default=True)
    email_queue_warning_threshold = Column(Integer, nullable=False, default=20)
    monitor_pdf_queue_enabled = Column(Boolean, nullable=False, default=True)
    pdf_queue_warning_threshold = Column(Integer, nullable=False, default=10)
    monitor_dlq_enabled = Column(Boolean, nullable=False, default=True)
    dlq_warning_threshold = Column(Integer, nullable=False, default=10)
    queue_monitor_state_json = Column(Text, nullable=True)

    last_session_cleanup_enqueued_at = Column(DateTime, nullable=True)
    last_session_cleanup_enqueued_slot = Column(String(12), nullable=True)
    last_session_cleanup_started_at = Column(DateTime, nullable=True)
    last_session_cleanup_finished_at = Column(DateTime, nullable=True)
    last_session_cleanup_status = Column(String(20), nullable=True)
    last_session_cleanup_message = Column(String(500), nullable=True)
    last_session_cleanup_affected_count = Column(Integer, nullable=True)

    last_temp_cleanup_enqueued_at = Column(DateTime, nullable=True)
    last_temp_cleanup_enqueued_slot = Column(String(12), nullable=True)
    last_temp_cleanup_started_at = Column(DateTime, nullable=True)
    last_temp_cleanup_finished_at = Column(DateTime, nullable=True)
    last_temp_cleanup_status = Column(String(20), nullable=True)
    last_temp_cleanup_message = Column(String(500), nullable=True)
    last_temp_cleanup_affected_count = Column(Integer, nullable=True)

    created_at = Column(DateTime, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")

    def __repr__(self) -> str:
        return f"<SystemMaintenanceSetting id={self.id} session_cleanup={bool(self.session_cleanup_enabled)} temp_cleanup={bool(self.temp_cleanup_enabled)}>"

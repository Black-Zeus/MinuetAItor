from __future__ import annotations

from sqlalchemy import JSON, Boolean, Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.mysql import BIGINT
from sqlalchemy.orm import relationship

from core.datetime_utils import utc_now_db
from db.base import Base


class AiUsageEvent(Base):
    __tablename__ = "ai_usage_events"

    id = Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    event_type = Column(String(40), nullable=False)
    status = Column(
        Enum("success", "failed", "timeout", "cancelled", name="ai_usage_event_status"),
        nullable=False,
        default="success",
    )

    minute_transaction_id = Column(String(36), ForeignKey("minute_transactions.id"), nullable=True)
    record_id = Column(String(36), ForeignKey("records.id"), nullable=True)
    record_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=True)
    client_id = Column(String(36), ForeignKey("clients.id"), nullable=True)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=True)
    ai_profile_id = Column(String(36), ForeignKey("ai_profiles.id"), nullable=True)
    requested_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    provider_config_id = Column(String(36), ForeignKey("ai_provider_configs.id"), nullable=True)
    pricing_id = Column(String(36), ForeignKey("ai_model_pricing.id"), nullable=True)

    provider_type = Column(String(40), nullable=True)
    provider_family = Column(String(40), nullable=True)
    execution_adapter = Column(String(40), nullable=True)
    provider_name_snapshot = Column(String(120), nullable=True)
    model_name = Column(String(180), nullable=True)

    external_run_id = Column(String(120), nullable=True)
    external_thread_id = Column(String(120), nullable=True)

    started_at = Column(DateTime, nullable=False, default=utc_now_db, server_default=func.now())
    finished_at = Column(DateTime, nullable=True)
    latency_ms = Column(Integer, nullable=True)

    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)

    currency = Column(String(3), nullable=False, default="USD")
    input_cost = Column(Numeric(14, 6), nullable=True)
    output_cost = Column(Numeric(14, 6), nullable=True)
    total_cost = Column(Numeric(14, 6), nullable=True)
    cost_estimated = Column(Boolean, nullable=False, default=False)
    cost_source = Column(String(40), nullable=True)

    error_code = Column(String(80), nullable=True)
    error_message = Column(Text, nullable=True)

    provider_usage_raw_json = Column(JSON, nullable=True)
    provider_meta_json = Column(JSON, nullable=True)

    created_at = Column(DateTime, nullable=False, default=utc_now_db, server_default=func.now())

    minute_transaction = relationship("MinuteTransaction", lazy="select")
    record = relationship("Record", foreign_keys=[record_id], lazy="select")
    record_version = relationship("RecordVersion", foreign_keys=[record_version_id], lazy="select")
    client = relationship("Client", foreign_keys=[client_id], lazy="select")
    project = relationship("Project", foreign_keys=[project_id], lazy="select")
    ai_profile = relationship("AiProfile", foreign_keys=[ai_profile_id], lazy="select")
    requested_by_user = relationship("User", foreign_keys=[requested_by], lazy="select")
    provider_config = relationship("AiProviderConfig", foreign_keys=[provider_config_id], lazy="select")
    pricing = relationship("AiModelPricing", foreign_keys=[pricing_id], lazy="select")

    def __repr__(self) -> str:
        return (
            f"<AiUsageEvent id={self.id} event_type={self.event_type!r} "
            f"status={self.status!r} provider_type={self.provider_type!r} model_name={self.model_name!r}>"
        )

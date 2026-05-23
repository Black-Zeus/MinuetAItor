from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class AiModelPricing(Base, TimestampMixin):
    __tablename__ = "ai_model_pricing"

    id = Column(String(36), primary_key=True)

    provider_type = Column(String(40), nullable=False)
    model_name = Column(String(180), nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    input_price_per_million = Column(Numeric(14, 6), nullable=True)
    output_price_per_million = Column(Numeric(14, 6), nullable=True)
    effective_from = Column(DateTime, nullable=False)
    effective_to = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return (
            f"<AiModelPricing id={self.id} provider_type={self.provider_type!r} "
            f"model_name={self.model_name!r}>"
        )

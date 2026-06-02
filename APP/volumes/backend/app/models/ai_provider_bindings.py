from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from core.datetime_utils import utc_now_db
from db.base import Base


class AiProviderBinding(Base):
    __tablename__ = "ai_provider_bindings"

    id = Column(String(36), primary_key=True)
    purpose = Column(String(60), nullable=False)
    provider_config_id = Column(String(36), ForeignKey("ai_provider_configs.id"), nullable=False)
    model_name = Column(String(180), nullable=False)
    embedding_dimensions = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=utc_now_db)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, nullable=True, default=utc_now_db, onupdate=utc_now_db)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    provider_config = relationship("AiProviderConfig", lazy="select")
    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return (
            "<AiProviderBinding "
            f"id={self.id} purpose={self.purpose!r} provider={self.provider_config_id} "
            f"model={self.model_name!r} active={bool(self.is_active)}>"
        )

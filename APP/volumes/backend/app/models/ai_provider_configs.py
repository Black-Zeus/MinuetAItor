from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class AiProviderConfig(Base, TimestampMixin):
    __tablename__ = "ai_provider_configs"

    id = Column(String(36), primary_key=True)

    name = Column(String(120), nullable=False)
    provider_type = Column(String(40), nullable=False)
    base_url = Column(String(255), nullable=False)
    validation_endpoint = Column(String(255), nullable=True)
    models_endpoint = Column(String(255), nullable=True)
    model_name = Column(String(180), nullable=True)
    auth_type = Column(String(40), nullable=False, default="none")
    token_secret = Column(Text, nullable=True)
    username = Column(String(255), nullable=True)
    password_secret = Column(Text, nullable=True)
    custom_headers_json = Column(Text, nullable=True)
    allow_model_discovery = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=False)
    validation_status = Column(String(40), nullable=False, default="unvalidated")
    last_validated_at = Column(DateTime, nullable=True)
    last_validated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    last_error = Column(Text, nullable=True)
    timeout_seconds = Column(Integer, nullable=False, default=15)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")
    last_validated_by_user = relationship("User", foreign_keys=[last_validated_by], lazy="select")

    def __repr__(self) -> str:
        return f"<AiProviderConfig id={self.id} name={self.name!r} active={bool(self.is_active)}>"

from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class SmtpConfig(Base, TimestampMixin):
    __tablename__ = "smtp_configs"

    id = Column(String(36), primary_key=True)

    name = Column(String(120), nullable=False)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False, default=587)
    username = Column(String(255), nullable=True)
    password = Column(String(255), nullable=True)
    from_name = Column(String(180), nullable=False)
    from_email = Column(String(254), nullable=False)
    use_tls = Column(Boolean, nullable=False, default=False)
    use_ssl = Column(Boolean, nullable=False, default=False)
    timeout_seconds = Column(Integer, nullable=False, default=10)
    is_active = Column(Boolean, nullable=False, default=False)

    last_tested_at = Column(DateTime, nullable=True)
    last_tested_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")
    last_tested_by_user = relationship("User", foreign_keys=[last_tested_by], lazy="select")

    def __repr__(self) -> str:
        return f"<SmtpConfig id={self.id} name={self.name!r} active={bool(self.is_active)}>"

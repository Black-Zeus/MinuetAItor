from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from core.datetime_utils import utc_now_db
from db.base import Base


class AiContextSetting(Base):
    __tablename__ = "ai_context_settings"

    id = Column(Integer, primary_key=True)

    context_ai_enabled = Column(Boolean, nullable=False, default=False)
    query_enabled = Column(Boolean, nullable=False, default=False)
    indexing_enabled = Column(Boolean, nullable=False, default=False)
    sync_enabled = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, nullable=False, default=utc_now_db)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, nullable=True, default=utc_now_db, onupdate=utc_now_db)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")

    def __repr__(self) -> str:
        return (
            "<AiContextSetting "
            f"id={self.id} enabled={bool(self.context_ai_enabled)} "
            f"query={bool(self.query_enabled)} indexing={bool(self.indexing_enabled)} "
            f"sync={bool(self.sync_enabled)}>"
        )

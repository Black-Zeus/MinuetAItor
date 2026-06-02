from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from db.base import Base


class SystemEvent(Base):
    __tablename__ = "system_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_at = Column(DateTime, nullable=False)
    domain = Column(String(60), nullable=False)
    event_type = Column(String(100), nullable=False)
    severity = Column(String(30), nullable=False, default="info")
    status = Column(String(30), nullable=False, default="success")
    subject = Column(String(255), nullable=False)
    detail = Column(String(700), nullable=True)
    entity_type = Column(String(80), nullable=True)
    entity_id = Column(String(80), nullable=True)
    actor_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    actor_snapshot_json = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)

    actor = relationship("User", foreign_keys=[actor_user_id], lazy="select")

    def __repr__(self) -> str:
        return f"<SystemEvent id={self.id} domain={self.domain!r} event_type={self.event_type!r}>"

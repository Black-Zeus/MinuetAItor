# models/audit_log.py
from sqlalchemy import Column, String, DateTime, Text, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id           = Column(BigInteger, primary_key=True, autoincrement=True)
    event_at     = Column(DateTime, nullable=False)
    actor_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    action       = Column(String(80), nullable=False)
    entity_type  = Column(String(80), nullable=False)
    entity_id    = Column(String(36), nullable=True)
    details_json = Column(Text, nullable=True)

    actor = relationship("User", foreign_keys=[actor_user_id])
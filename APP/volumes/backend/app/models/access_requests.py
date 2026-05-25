from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from db.base import Base


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(String(36), primary_key=True)
    full_name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False)
    observation = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="pending")
    source = Column(String(60), nullable=False, default="login")
    request_ip = Column(String(80), nullable=True)
    request_user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<AccessRequest id={self.id} email={self.email!r} status={self.status!r}>"

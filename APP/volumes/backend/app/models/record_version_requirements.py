from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from db.base import Base


class RecordVersionRequirement(Base):
    __tablename__ = "record_version_requirements"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    record_id = Column(String(36), ForeignKey("records.id"), nullable=False)
    record_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=False)
    requirement_code = Column(String(60), nullable=False)
    entity = Column(String(220), nullable=True)
    body = Column(Text, nullable=False)
    responsible = Column(String(220), nullable=True)
    priority = Column(String(40), nullable=False, default="medium")
    status = Column(String(40), nullable=False, default="open")
    source_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    record = relationship("Record", lazy="select")
    record_version = relationship("RecordVersion", lazy="select")

    def __repr__(self) -> str:
        return f"<RecordVersionRequirement id={self.id} record_version_id={self.record_version_id}>"

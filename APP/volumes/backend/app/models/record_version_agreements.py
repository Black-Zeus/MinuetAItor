from __future__ import annotations

from sqlalchemy import BigInteger, Column, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from db.base import Base


class RecordVersionAgreement(Base):
    __tablename__ = "record_version_agreements"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    record_id = Column(String(36), ForeignKey("records.id"), nullable=False)
    record_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=False)
    agreement_code = Column(String(60), nullable=False)
    subject = Column(String(300), nullable=False)
    body = Column(Text, nullable=True)
    responsible = Column(String(220), nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(String(40), nullable=False, default="pending")
    source_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    record = relationship("Record", lazy="select")
    record_version = relationship("RecordVersion", lazy="select")

    def __repr__(self) -> str:
        return f"<RecordVersionAgreement id={self.id} record_version_id={self.record_version_id}>"

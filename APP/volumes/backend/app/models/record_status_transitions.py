from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, JSON, SmallInteger, String, func
from sqlalchemy.orm import relationship

from core.datetime_utils import utc_now_db
from db.base import Base


class RecordStatusTransition(Base):
    __tablename__ = "record_status_transitions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    record_id = Column(String(36), ForeignKey("records.id"), nullable=False)
    minute_transaction_id = Column(String(36), ForeignKey("minute_transactions.id"), nullable=True)
    record_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=True)

    from_status_id = Column(SmallInteger, ForeignKey("record_statuses.id"), nullable=True)
    to_status_id = Column(SmallInteger, ForeignKey("record_statuses.id"), nullable=False)

    changed_at = Column(DateTime, nullable=False, default=utc_now_db, server_default=func.now())
    changed_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    source = Column(String(40), nullable=False)
    transition_reason = Column(String(80), nullable=True)
    metadata_json = Column(JSON, nullable=True)

    record = relationship("Record", foreign_keys=[record_id], lazy="select")
    minute_transaction = relationship("MinuteTransaction", foreign_keys=[minute_transaction_id], lazy="select")
    record_version = relationship("RecordVersion", foreign_keys=[record_version_id], lazy="select")
    from_status = relationship("RecordStatus", foreign_keys=[from_status_id], lazy="select")
    to_status = relationship("RecordStatus", foreign_keys=[to_status_id], lazy="select")
    changed_by_user = relationship("User", foreign_keys=[changed_by], lazy="select")

    def __repr__(self) -> str:
        return (
            f"<RecordStatusTransition id={self.id} record_id={self.record_id} "
            f"from_status_id={self.from_status_id} to_status_id={self.to_status_id}>"
        )

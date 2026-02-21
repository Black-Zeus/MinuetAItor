# models/record_types.py

from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, SmallInteger, String
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class RecordType(Base, TimestampMixin):
    __tablename__ = "record_types"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)

    code = Column(String(50), nullable=False, unique=True, index=False)
    name = Column(String(120), nullable=False)
    description = Column(String(255), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return f"<RecordType id={self.id} code={self.code!r} name={self.name!r} active={bool(self.is_active)}>"
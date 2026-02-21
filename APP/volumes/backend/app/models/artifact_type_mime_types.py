from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.mysql import SMALLINT
from sqlalchemy.orm import relationship

from db.base import Base


class ArtifactTypeMimeType(Base):
    __tablename__ = "artifact_type_mime_types"

    artifact_type_id = Column(SMALLINT(unsigned=True), ForeignKey("artifact_types.id"), primary_key=True)
    mime_type_id     = Column(SMALLINT(unsigned=True), ForeignKey("mime_types.id"), primary_key=True)

    is_default = Column(Boolean, nullable=False, server_default="0")
    is_active  = Column(Boolean, nullable=False, server_default="1")

    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    updated_at = Column(DateTime, nullable=True, onupdate=func.current_timestamp())
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Relaciones principales
    artifact_type = relationship("ArtifactType", lazy="select")
    mime_type     = relationship("MimeType", lazy="select")

    # Relaciones auditoría
    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return (
            f"<ArtifactTypeMimeType artifact_type_id={self.artifact_type_id} "
            f"mime_type_id={self.mime_type_id} active={self.is_active} default={self.is_default}>"
        )
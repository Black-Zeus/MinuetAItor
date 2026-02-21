# models/mime_type_extensions.py

from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.mysql import SMALLINT
from sqlalchemy.orm import relationship

from db.base import Base


class MimeTypeExtension(Base):
    __tablename__ = "mime_type_extensions"

    # ── PK compuesta ──────────────────────────────────────────────────────────
    mime_type_id = Column(
        SMALLINT(unsigned=True),
        ForeignKey("mime_types.id"),
        primary_key=True,
        nullable=False,
    )
    file_extension_id = Column(
        SMALLINT(unsigned=True),
        ForeignKey("file_extensions.id"),
        primary_key=True,
        nullable=False,
    )

    # ── Flags ────────────────────────────────────────────────────────────────
    is_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)

    # ── Auditoría / timestamps (según DDL) ───────────────────────────────────
    created_at = Column(DateTime, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    updated_at = Column(DateTime, nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # ── Relationships ────────────────────────────────────────────────────────
    mime_type = relationship(
        "MimeType",
        foreign_keys=[mime_type_id],
        lazy="select",
    )

    file_extension = relationship(
        "FileExtension",
        foreign_keys=[file_extension_id],
        lazy="select",
    )

    created_by_user = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="select",
    )
    updated_by_user = relationship(
        "User",
        foreign_keys=[updated_by],
        lazy="select",
    )
    deleted_by_user = relationship(
        "User",
        foreign_keys=[deleted_by],
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<MimeTypeExtension mime_type_id={self.mime_type_id} "
            f"file_extension_id={self.file_extension_id} "
            f"is_default={bool(self.is_default)} is_active={bool(self.is_active)}>"
        )
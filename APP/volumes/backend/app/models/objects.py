# models/objects.py
from __future__ import annotations

from sqlalchemy import BigInteger, DateTime, ForeignKey, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin


class Object(Base, TimestampMixin):
    __tablename__ = "objects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    bucket_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("buckets.id", name="fk_obj_bucket"),
        nullable=False,
    )
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)

    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    file_ext: Mapped[str] = mapped_column(String(20), nullable=False)

    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    etag: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_by: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", name="fk_obj_created_by"),
        nullable=True,
    )

    deleted_at: Mapped["DateTime | None"] = mapped_column(DateTime, nullable=True)
    deleted_by: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", name="fk_obj_deleted_by"),
        nullable=True,
    )

    # Relationships
    bucket = relationship("Bucket", lazy="select")
    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return f"<Object id={self.id} bucket_id={self.bucket_id} object_key={self.object_key!r}>"
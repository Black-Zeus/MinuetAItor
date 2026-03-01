# models/objects.py
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class Object(Base):
    """
    Puntero a un objeto en MinIO.

    NO usa TimestampMixin: la tabla objects NO tiene updated_at.
    Los objetos son inmutables una vez escritos (append-only).

    Columnas mime_type_id y file_extension_id existen via 20_schema_alter_indexes.sql.
    El trigger trg_objects_sync_mime_ext_ins las resuelve automáticamente:
      - Si se envía content_type → el trigger resuelve mime_type_id
      - Si se envía file_ext     → el trigger resuelve file_extension_id
    REQUISITO: el content_type debe coincidir EXACTAMENTE con mime_types.mime en BD.
    """
    __tablename__ = "objects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    bucket_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("buckets.id", name="fk_obj_bucket"),
        nullable=False,
    )
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)

    # Columnas agregadas via ALTER TABLE (20_schema_alter_indexes.sql)
    # El trigger las resuelve automáticamente al insertar
    mime_type_id: Mapped[int | None] = mapped_column(
        SmallInteger,
        ForeignKey("mime_types.id", name="fk_obj_mime_type"),
        nullable=True,
    )
    file_extension_id: Mapped[int | None] = mapped_column(
        SmallInteger,
        ForeignKey("file_extensions.id", name="fk_obj_file_ext"),
        nullable=True,
    )

    # Texto sincronizado por el trigger (fuente de verdad secundaria)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    file_ext: Mapped[str] = mapped_column(String(20), nullable=False)

    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    etag: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Solo created_at — no hay updated_at en el DDL
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    created_by: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", name="fk_obj_created_by"),
        nullable=True,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_by: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", name="fk_obj_deleted_by"),
        nullable=True,
    )

    # Relationships
    bucket         = relationship("Bucket",    lazy="select")
    mime_type      = relationship("MimeType",  lazy="select", foreign_keys=[mime_type_id])
    file_extension = relationship("FileExtension", lazy="select", foreign_keys=[file_extension_id])
    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return f"<Object id={self.id} bucket_id={self.bucket_id} object_key={self.object_key!r}>"
# models/user_project_acl.py

from __future__ import annotations

import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import relationship

from db.base import Base, TimestampMixin


class UserProjectPermission(str, enum.Enum):
    read = "read"
    edit = "edit"
    owner = "owner"


class UserProjectACL(Base, TimestampMixin):
    __tablename__ = "user_project_acl"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id"), primary_key=True)

    permission = Column(
        Enum(UserProjectPermission, name="user_project_permission"),
        nullable=False,
        default=UserProjectPermission.read,
    )
    is_active = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Relaciones de negocio
    user = relationship("User", foreign_keys=[user_id], lazy="select")
    project = relationship("Project", foreign_keys=[project_id], lazy="select")

    # Auditoría (UserRefResponse)
    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by], lazy="select")

    def __repr__(self) -> str:
        return (
            f"<UserProjectACL user_id={self.user_id!r} "
            f"project_id={self.project_id!r} permission={self.permission!r} "
            f"is_active={self.is_active!r}>"
        )
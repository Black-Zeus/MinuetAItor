# models/user_profiles.py
from __future__ import annotations

import enum

from sqlalchemy import Column, Date, Enum, ForeignKey, String
from sqlalchemy.orm import relationship

from db.base import Base


class AssignmentModeEnum(str, enum.Enum):
    all      = "all"
    specific = "specific"


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)

    initials        = Column(String(10), nullable=True)
    color           = Column(String(20), nullable=True)
    position        = Column(String(120), nullable=True)
    department      = Column(String(80), nullable=True)
    notes           = Column(String(600), nullable=True)
    last_activity   = Column(Date, nullable=True)

    # CORRECCIÓN: campo assignment_mode agregado al modelo
    assignment_mode = Column(
        Enum(AssignmentModeEnum, name="assignment_mode_enum"),
        nullable=False,
        default=AssignmentModeEnum.specific,
        server_default=AssignmentModeEnum.specific.value,
    )

    user = relationship(
        "User",
        back_populates="profile",
        lazy="select",
        uselist=False,
    )

    def __repr__(self) -> str:
        return f"<UserProfile user_id={self.user_id!r} initials={self.initials!r} assignment_mode={self.assignment_mode!r}>"
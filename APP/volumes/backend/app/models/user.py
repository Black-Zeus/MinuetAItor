# models/user.py
from sqlalchemy import Column, String, Boolean, DateTime, SmallInteger, Integer, ForeignKey, Date
from sqlalchemy.orm import relationship
from db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id            = Column(String(36), primary_key=True)
    username      = Column(String(80), nullable=False, unique=True)
    email         = Column(String(200), nullable=True, unique=True)
    password_hash = Column(String(255), nullable=False)
    full_name     = Column(String(200), nullable=True)
    is_active     = Column(Boolean, nullable=False, default=True)
    last_login_at = Column(DateTime, nullable=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    roles   = relationship(
        "UserRole",
        foreign_keys="[UserRole.user_id]",
        back_populates="user",
        lazy="select",
    )
    profile = relationship(
        "UserProfile",
        foreign_keys="[UserProfile.user_id]",
        back_populates="user",
        uselist=False,
        lazy="select",
    )


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id          = Column(SmallInteger, primary_key=True, autoincrement=True)
    code        = Column(String(50), nullable=False, unique=True)
    name        = Column(String(120), nullable=False)
    description = Column(String(255), nullable=True)
    is_active   = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    permissions = relationship(
        "RolePermission",
        foreign_keys="[RolePermission.role_id]",
        back_populates="role",
        lazy="select",
    )


class Permission(Base, TimestampMixin):
    __tablename__ = "permissions"

    id          = Column(SmallInteger, primary_key=True, autoincrement=True)
    code        = Column(String(100), nullable=False, unique=True)
    name        = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)
    is_active   = Column(Boolean, nullable=False, default=True)

    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id       = Column(SmallInteger, ForeignKey("roles.id"), primary_key=True)
    permission_id = Column(SmallInteger, ForeignKey("permissions.id"), primary_key=True)
    created_at    = Column(DateTime, nullable=False)
    created_by    = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at    = Column(DateTime, nullable=True)
    deleted_by    = Column(String(36), ForeignKey("users.id"), nullable=True)

    role = relationship(
        "Role",
        foreign_keys=[role_id],
        back_populates="permissions",
    )
    permission = relationship(
        "Permission",
        foreign_keys=[permission_id],
    )


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id    = Column(String(36), ForeignKey("users.id"), primary_key=True)
    role_id    = Column(SmallInteger, ForeignKey("roles.id"), primary_key=True)
    created_at = Column(DateTime, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    user = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="roles",
    )
    role = relationship(
        "Role",
        foreign_keys=[role_id],
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id       = Column(String(36), ForeignKey("users.id"), primary_key=True)
    initials      = Column(String(10), nullable=True)
    color         = Column(String(20), nullable=True)
    position      = Column(String(120), nullable=True)
    department    = Column(String(80), nullable=True)
    notes         = Column(String(600), nullable=True)
    last_activity = Column(Date, nullable=True)

    user = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="profile",
    )
# repositories/auth_repository.py
from sqlalchemy.orm import Session, joinedload
from models.user import User, UserRole, Role, RolePermission, Permission, UserProfile


def get_user_by_credential(db: Session, credential: str) -> User | None:
    """Busca por username o email, excluye soft-deleted e inactivos."""
    return (
        db.query(User)
        .filter(
            User.deleted_at.is_(None),
            User.is_active.is_(True),
            (User.username == credential) | (User.email == credential),
        )
        .first()
    )


def get_user_with_roles_permissions(db: Session, user_id: str) -> User | None:
    """Carga usuario + roles + permisos en una sola query con joinedload correcto."""
    return (
        db.query(User)
        .options(
            joinedload(User.roles).joinedload(UserRole.role).joinedload(Role.permissions).joinedload(RolePermission.permission)
        )
        .filter(
            User.id == user_id,
            User.deleted_at.is_(None),
        )
        .first()
    )

def get_user_full(db: Session, user_id: str) -> User | None:
    """Usuario + perfil para el endpoint /me."""
    return (
        db.query(User)
        .options(
            joinedload(User.profile, innerjoin=False)
        )
        .filter(
            User.id == user_id,
            User.deleted_at.is_(None),
        )
        .first()
    )

def get_user_by_id(db: Session, user_id: str) -> User | None:
    return (
        db.query(User)
        .filter(User.id == user_id, User.deleted_at.is_(None))
        .first()
    )
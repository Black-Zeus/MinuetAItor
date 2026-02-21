# services/user_roles_service.py
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.user_roles import UserRole


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _role_ref(r) -> dict | None:
    if not r:
        return None
    return {
        "id": int(getattr(r, "id", 0)),
        "code": getattr(r, "code", None),
        "name": getattr(r, "name", None),
    }


def _build_response_dict(obj: UserRole) -> dict[str, Any]:
    return {
        "userId": str(obj.user_id),
        "roleId": int(obj.role_id),
        "createdAt": obj.created_at.isoformat() if obj.created_at else None,
        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
        "user": _user_ref(getattr(obj, "user", None)),
        "role": _role_ref(getattr(obj, "role", None)),
    }


def _get_or_404(db: Session, user_id: str, role_id: int) -> UserRole:
    obj = (
        db.query(UserRole)
        .options(
            joinedload(UserRole.user),
            joinedload(UserRole.role),
            joinedload(UserRole.created_by_user),
            joinedload(UserRole.deleted_by_user),
        )
        .filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
            UserRole.deleted_at.is_(None),
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def get_user_role(db: Session, user_id: str, role_id: int) -> dict[str, Any]:
    obj = _get_or_404(db, user_id, role_id)
    return _build_response_dict(obj)


def list_user_roles(db: Session, filters) -> dict[str, Any]:
    q = db.query(UserRole).filter(UserRole.deleted_at.is_(None))

    if getattr(filters, "user_id", None):
        q = q.filter(UserRole.user_id == filters.user_id)
    if getattr(filters, "role_id", None):
        q = q.filter(UserRole.role_id == filters.role_id)

    total = q.with_entities(func.count(UserRole.user_id)).scalar() or 0

    items = (
        q.options(
            joinedload(UserRole.user),
            joinedload(UserRole.role),
            joinedload(UserRole.created_by_user),
            joinedload(UserRole.deleted_by_user),
        )
        .order_by(UserRole.created_at.desc())
        .offset(int(filters.skip))
        .limit(int(filters.limit))
        .all()
    )

    return {
        "items": [_build_response_dict(x) for x in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def create_user_role(db: Session, body, created_by_id: str) -> dict[str, Any]:
    # Considera también filas borradas para permitir restore
    existing = (
        db.query(UserRole)
        .filter(UserRole.user_id == body.user_id, UserRole.role_id == body.role_id)
        .first()
    )

    if existing and existing.deleted_at is None:
        raise HTTPException(status_code=409, detail="USER_ROLE_ALREADY_ASSIGNED")

    if existing and existing.deleted_at is not None:
        existing.deleted_at = None
        existing.deleted_by = None
        # no se altera created_at; se actualiza created_by como auditoría del restore/alta lógica
        existing.created_by = created_by_id
        db.commit()
        obj = _get_or_404(db, existing.user_id, existing.role_id)
        return _build_response_dict(obj)

    obj = UserRole(
        user_id=body.user_id,
        role_id=int(body.role_id),
        created_at=datetime.utcnow(),
        created_by=created_by_id,
        deleted_at=None,
        deleted_by=None,
    )
    db.add(obj)
    db.commit()

    obj = _get_or_404(db, obj.user_id, obj.role_id)
    return _build_response_dict(obj)


def update_user_role(db: Session, user_id: str, role_id: int, body, updated_by_id: str) -> dict[str, Any]:
    # Tabla pivote: PUT se interpreta como operación idempotente:
    # - si existe activo => retorna
    # - si existe borrado => restaura
    # - si no existe => crea
    existing = (
        db.query(UserRole)
        .filter(UserRole.user_id == user_id, UserRole.role_id == role_id)
        .first()
    )

    if existing and existing.deleted_at is None:
        obj = _get_or_404(db, user_id, role_id)
        return _build_response_dict(obj)

    if existing and existing.deleted_at is not None:
        existing.deleted_at = None
        existing.deleted_by = None
        existing.created_by = updated_by_id
        db.commit()
        obj = _get_or_404(db, user_id, role_id)
        return _build_response_dict(obj)

    obj = UserRole(
        user_id=user_id,
        role_id=int(role_id),
        created_at=datetime.utcnow(),
        created_by=updated_by_id,
        deleted_at=None,
        deleted_by=None,
    )
    db.add(obj)
    db.commit()

    obj = _get_or_404(db, obj.user_id, obj.role_id)
    return _build_response_dict(obj)


def delete_user_role(db: Session, user_id: str, role_id: int, deleted_by_id: str) -> None:
    obj = (
        db.query(UserRole)
        .filter(UserRole.user_id == user_id, UserRole.role_id == role_id, UserRole.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    db.commit()
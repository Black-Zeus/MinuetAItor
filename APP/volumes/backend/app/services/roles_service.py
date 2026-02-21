# services/roles_service.py

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from models.roles import Role


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: Role) -> dict[str, Any]:
    return {
        "id": int(obj.id),
        "code": obj.code,
        "name": obj.name,
        "description": obj.description,
        "is_active": bool(obj.is_active),
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
        "created_by": _user_ref(getattr(obj, "created_by_user", None)),
        "updated_by": _user_ref(getattr(obj, "updated_by_user", None)),
        "deleted_at": obj.deleted_at,
        "deleted_by": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, role_id: int) -> Role:
    obj = (
        db.query(Role)
        .options(
            joinedload(Role.created_by_user),
            joinedload(Role.updated_by_user),
            joinedload(Role.deleted_by_user),
        )
        .filter(Role.id == role_id, Role.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_code(db: Session, code: str, exclude_id: int | None = None) -> None:
    q = db.query(Role).filter(Role.code == code, Role.deleted_at.is_(None))
    if exclude_id is not None:
        q = q.filter(Role.id != exclude_id)
    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="CODE_ALREADY_EXISTS")


def get_role(db: Session, role_id: int) -> dict[str, Any]:
    obj = _get_or_404(db, role_id)
    return _build_response_dict(obj)


def list_roles(db: Session, filters) -> dict[str, Any]:
    q = db.query(Role).filter(Role.deleted_at.is_(None))

    if filters.is_active is True:
        q = q.filter(Role.is_active.is_(True))
    elif filters.is_active is False:
        q = q.filter(Role.is_active.is_(False))

    if filters.code:
        q = q.filter(Role.code.like(f"%{filters.code}%"))
    if filters.name:
        q = q.filter(Role.name.like(f"%{filters.name}%"))
    if filters.q:
        like = f"%{filters.q}%"
        q = q.filter(or_(Role.code.like(like), Role.name.like(like)))

    total = q.with_entities(func.count(Role.id)).scalar() or 0

    items = (
        q.options(
            joinedload(Role.created_by_user),
            joinedload(Role.updated_by_user),
            joinedload(Role.deleted_by_user),
        )
        .order_by(Role.name.asc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(x) for x in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def create_role(db: Session, body, created_by_id: str) -> dict[str, Any]:
    _check_unique_code(db, body.code, exclude_id=None)

    obj = Role(
        code=body.code,
        name=body.name,
        description=body.description,
        is_active=bool(body.is_active),
        created_by=created_by_id,
        updated_by=created_by_id,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, int(obj.id))
    return _build_response_dict(obj)


def update_role(db: Session, role_id: int, body, updated_by_id: str) -> dict[str, Any]:
    obj = _get_or_404(db, role_id)

    if body.code is not None and body.code != obj.code:
        _check_unique_code(db, body.code, exclude_id=role_id)
        obj.code = body.code

    if body.name is not None:
        obj.name = body.name

    if body.description is not None:
        obj.description = body.description

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, role_id)
    return _build_response_dict(obj)


def change_role_status(db: Session, role_id: int, is_active: bool, updated_by_id: str) -> dict[str, Any]:
    obj = _get_or_404(db, role_id)

    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, role_id)
    return _build_response_dict(obj)


def delete_role(db: Session, role_id: int, deleted_by_id: str) -> None:
    obj = _get_or_404(db, role_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False
    obj.updated_by = deleted_by_id

    db.commit()
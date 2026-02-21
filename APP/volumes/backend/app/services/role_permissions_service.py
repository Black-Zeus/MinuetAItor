# services/role_permissions_service.py
from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.role_permissions import RolePermission
from schemas.role_permissions import (
    RolePermissionCreateRequest,
    RolePermissionFilterRequest,
    RolePermissionUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: RolePermission) -> dict:
    role_obj = getattr(obj, "role", None)
    perm_obj = getattr(obj, "permission", None)

    return {
        "roleId": int(obj.role_id),
        "permissionId": int(obj.permission_id),
        "createdAt": obj.created_at.isoformat() if obj.created_at else None,
        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
        "role": None
        if not role_obj
        else {
            "id": int(getattr(role_obj, "id")),
            "code": getattr(role_obj, "code", None),
            "name": getattr(role_obj, "name", None),
            "isActive": bool(getattr(role_obj, "is_active", True))
            if getattr(role_obj, "is_active", None) is not None
            else None,
        },
        "permission": None
        if not perm_obj
        else {
            "id": int(getattr(perm_obj, "id")),
            "code": getattr(perm_obj, "code", None),
            "name": getattr(perm_obj, "name", None),
            "isActive": bool(getattr(perm_obj, "is_active", True))
            if getattr(perm_obj, "is_active", None) is not None
            else None,
        },
    }


def _get_or_404(db: Session, role_id: int, permission_id: int) -> RolePermission:
    q = (
        db.query(RolePermission)
        .options(
            joinedload(RolePermission.role),
            joinedload(RolePermission.permission),
            joinedload(RolePermission.created_by_user),
            joinedload(RolePermission.deleted_by_user),
        )
        .filter(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
            RolePermission.deleted_at.is_(None),
        )
    )
    obj = q.first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def get_role_permission(db: Session, role_id: int, permission_id: int) -> dict:
    obj = _get_or_404(db, role_id, permission_id)
    return _build_response_dict(obj)


def list_role_permissions(db: Session, filters: RolePermissionFilterRequest) -> dict:
    q = db.query(RolePermission)

    if not filters.include_deleted:
        q = q.filter(RolePermission.deleted_at.is_(None))

    if filters.role_id is not None:
        q = q.filter(RolePermission.role_id == filters.role_id)

    if filters.permission_id is not None:
        q = q.filter(RolePermission.permission_id == filters.permission_id)

    total = q.with_entities(func.count()).scalar() or 0

    items = (
        q.options(
            joinedload(RolePermission.role),
            joinedload(RolePermission.permission),
            joinedload(RolePermission.created_by_user),
            joinedload(RolePermission.deleted_by_user),
        )
        .order_by(RolePermission.role_id.asc(), RolePermission.permission_id.asc())
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


def create_role_permission(
    db: Session,
    body: RolePermissionCreateRequest,
    created_by_id: str,
) -> dict:
    existing = (
        db.query(RolePermission)
        .filter(
            RolePermission.role_id == body.role_id,
            RolePermission.permission_id == body.permission_id,
        )
        .first()
    )

    # Si existe soft-deleted => restaurar idempotente
    if existing and existing.deleted_at is not None:
        existing.deleted_at = None
        existing.deleted_by = None
        db.commit()
        obj = _get_or_404(db, existing.role_id, existing.permission_id)
        return _build_response_dict(obj)

    # Si ya existe activo => conflicto
    if existing and existing.deleted_at is None:
        raise HTTPException(status_code=409, detail="ROLE_PERMISSION_ALREADY_EXISTS")

    obj = RolePermission(
        role_id=body.role_id,
        permission_id=body.permission_id,
        created_at=datetime.utcnow(),
        created_by=created_by_id,
        deleted_at=None,
        deleted_by=None,
    )

    db.add(obj)
    db.commit()

    obj = _get_or_404(db, obj.role_id, obj.permission_id)
    return _build_response_dict(obj)


def update_role_permission(
    db: Session,
    role_id: int,
    permission_id: int,
    body: RolePermissionUpdateRequest,
    updated_by_id: str,  # se mantiene para simetría del patrón
) -> dict:
    # Semántica: PUT idempotente, opcionalmente permite "restore".
    obj_any = (
        db.query(RolePermission)
        .options(
            joinedload(RolePermission.role),
            joinedload(RolePermission.permission),
            joinedload(RolePermission.created_by_user),
            joinedload(RolePermission.deleted_by_user),
        )
        .filter(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
        )
        .first()
    )

    if not obj_any:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")

    if body.restore is True and obj_any.deleted_at is not None:
        obj_any.deleted_at = None
        obj_any.deleted_by = None
        db.commit()
        obj = _get_or_404(db, role_id, permission_id)
        return _build_response_dict(obj)

    # Si está activo, o no se pidió restore, devolvemos el recurso activo o 404 si está eliminado
    if obj_any.deleted_at is not None:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")

    return _build_response_dict(obj_any)


def delete_role_permission(db: Session, role_id: int, permission_id: int, deleted_by_id: str) -> None:
    obj = (
        db.query(RolePermission)
        .filter(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
            RolePermission.deleted_at.is_(None),
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id

    db.commit()
    return None
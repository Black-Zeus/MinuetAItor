# routers/v1/user_roles.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import require_roles
from db.session import get_db
from models.user_roles import UserRole
from schemas.auth import UserSession
from schemas.user_roles import (
    UserRoleCreateRequest,
    UserRoleFilterRequest,
    UserRoleListResponse,
    UserRoleResponse,
    UserRoleUpdateRequest,
)
from services.notification_center_service import create_in_app_notification
from services.user_roles_service import (
    create_user_role,
    delete_user_role,
    get_user_role,
    list_user_roles,
    update_user_role,
)

router = APIRouter(prefix="/user-roles", tags=["User Roles"])


@router.get(
    "/{user_id}/{role_id}",
    response_model=UserRoleResponse,
    status_code=status.HTTP_200_OK,
)
def get_endpoint(
    user_id: str,
    role_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return get_user_role(db, user_id=user_id, role_id=role_id)


@router.post(
    "/list",
    response_model=UserRoleListResponse,
    status_code=status.HTTP_200_OK,
)
def list_endpoint(
    body: UserRoleFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return list_user_roles(db, body)


@router.post(
    "",
    response_model=UserRoleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_endpoint(
    body: UserRoleCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    existing = (
        db.query(UserRole)
        .filter(UserRole.user_id == body.user_id, UserRole.role_id == body.role_id)
        .first()
    )
    result = create_user_role(db, body, created_by_id=session.user_id)

    if not existing or existing.deleted_at is not None:
        role_name = result.get("role", {}).get("name") or result.get("role", {}).get("code") or str(body.role_id)
        await create_in_app_notification(
            db,
            notification_type="rbac.role.granted",
            title="Rol asignado",
            message=f'Se te asignó el rol "{role_name}".',
            level="info",
            tags=["rbac", "role", "permission", "rbac.role.granted"],
            recipient_user_ids=[body.user_id],
            scope_type="user",
            scope_id=body.user_id,
            action_url="/settings/userProfile",
            actor_user_id=session.user_id,
            metadata={
                "targetUserId": body.user_id,
                "roleId": body.role_id,
                "roleCode": result.get("role", {}).get("code"),
                "roleName": result.get("role", {}).get("name"),
            },
        )

    return result


@router.put(
    "/{user_id}/{role_id}",
    response_model=UserRoleResponse,
    status_code=status.HTTP_200_OK,
)
async def put_endpoint(
    user_id: str,
    role_id: int,
    body: UserRoleUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    existing = (
        db.query(UserRole)
        .filter(UserRole.user_id == user_id, UserRole.role_id == role_id)
        .first()
    )
    result = update_user_role(db, user_id=user_id, role_id=role_id, body=body, updated_by_id=session.user_id)

    if not existing or existing.deleted_at is not None:
        role_name = result.get("role", {}).get("name") or result.get("role", {}).get("code") or str(role_id)
        await create_in_app_notification(
            db,
            notification_type="rbac.role.granted",
            title="Rol asignado",
            message=f'Se te asignó el rol "{role_name}".',
            level="info",
            tags=["rbac", "role", "permission", "rbac.role.granted"],
            recipient_user_ids=[user_id],
            scope_type="user",
            scope_id=user_id,
            action_url="/settings/userProfile",
            actor_user_id=session.user_id,
            metadata={
                "targetUserId": user_id,
                "roleId": role_id,
                "roleCode": result.get("role", {}).get("code"),
                "roleName": result.get("role", {}).get("name"),
            },
        )

    return result


@router.delete(
    "/{user_id}/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_endpoint(
    user_id: str,
    role_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    current = get_user_role(db, user_id=user_id, role_id=role_id)
    delete_user_role(db, user_id=user_id, role_id=role_id, deleted_by_id=session.user_id)
    role_name = current.get("role", {}).get("name") or current.get("role", {}).get("code") or str(role_id)
    await create_in_app_notification(
        db,
        notification_type="rbac.role.revoked",
        title="Rol revocado",
        message=f'Se revocó el rol "{role_name}" de tu cuenta.',
        level="warning",
        tags=["rbac", "role", "permission", "rbac.role.revoked"],
        recipient_user_ids=[user_id],
        scope_type="user",
        scope_id=user_id,
        action_url="/settings/userProfile",
        actor_user_id=session.user_id,
        metadata={
            "targetUserId": user_id,
            "roleId": role_id,
            "roleCode": current.get("role", {}).get("code"),
            "roleName": current.get("role", {}).get("name"),
        },
    )
    return None

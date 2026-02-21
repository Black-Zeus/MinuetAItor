# routers/v1/role_permissions.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.role_permissions import (
    RolePermissionCreateRequest,
    RolePermissionFilterRequest,
    RolePermissionListResponse,
    RolePermissionResponse,
    RolePermissionUpdateRequest,
)
from services.auth_service import get_current_user
from services.role_permissions_service import (
    create_role_permission,
    delete_role_permission,
    get_role_permission,
    list_role_permissions,
    update_role_permission,
)

router = APIRouter(prefix="/role-permissions", tags=["RolePermissions"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get(
    "/{role_id}/{permission_id}",
    response_model=RolePermissionResponse,
    status_code=status.HTTP_200_OK,
)
def get_endpoint(
    role_id: int,
    permission_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_role_permission(db, role_id=role_id, permission_id=permission_id)


# CRÍTICO: declarar /list antes del POST "" (patrón del proyecto)
@router.post(
    "/list",
    response_model=RolePermissionListResponse,
    status_code=status.HTTP_200_OK,
)
def list_endpoint(
    body: RolePermissionFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_role_permissions(db, body)


@router.post(
    "",
    response_model=RolePermissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_endpoint(
    body: RolePermissionCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_role_permission(db, body, created_by_id=session.user_id)


@router.put(
    "/{role_id}/{permission_id}",
    response_model=RolePermissionResponse,
    status_code=status.HTTP_200_OK,
)
def update_endpoint(
    role_id: int,
    permission_id: int,
    body: RolePermissionUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_role_permission(
        db,
        role_id=role_id,
        permission_id=permission_id,
        body=body,
        updated_by_id=session.user_id,
    )


@router.delete(
    "/{role_id}/{permission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_endpoint(
    role_id: int,
    permission_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_role_permission(db, role_id=role_id, permission_id=permission_id, deleted_by_id=session.user_id)
    return None
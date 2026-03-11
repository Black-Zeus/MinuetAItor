# routers/v1/user_roles.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import require_roles
from db.session import get_db
from schemas.auth import UserSession
from schemas.user_roles import (
    UserRoleCreateRequest,
    UserRoleFilterRequest,
    UserRoleListResponse,
    UserRoleResponse,
    UserRoleUpdateRequest,
)
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
def create_endpoint(
    body: UserRoleCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return create_user_role(db, body, created_by_id=session.user_id)


@router.put(
    "/{user_id}/{role_id}",
    response_model=UserRoleResponse,
    status_code=status.HTTP_200_OK,
)
def put_endpoint(
    user_id: str,
    role_id: int,
    body: UserRoleUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return update_user_role(db, user_id=user_id, role_id=role_id, body=body, updated_by_id=session.user_id)


@router.delete(
    "/{user_id}/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_endpoint(
    user_id: str,
    role_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    delete_user_role(db, user_id=user_id, role_id=role_id, deleted_by_id=session.user_id)
    return None

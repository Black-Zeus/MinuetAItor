# routers/v1/roles.py

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.roles import (
    RoleCreateRequest,
    RoleFilterRequest,
    RoleListResponse,
    RoleResponse,
    RoleStatusRequest,
    RoleUpdateRequest,
)
from services.auth_service import get_current_user
from services.roles_service import (
    change_role_status,
    create_role,
    delete_role,
    get_role,
    list_roles,
    update_role,
)

router = APIRouter(prefix="/roles", tags=["Roles"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=RoleResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_role(db, id)


# CRÍTICO: declarar /list antes que POST ""
@router.post("/list", response_model=RoleListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: RoleFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_roles(db, body)


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: RoleCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_role(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=RoleResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: RoleUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_role(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=RoleResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: int,
    body: RoleStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_role_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_role(db, id, deleted_by_id=session.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
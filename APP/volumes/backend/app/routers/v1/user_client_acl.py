# routers/v1/user_client_acl.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.user_client_acl import (
    UserClientAclCreateRequest,
    UserClientAclFilterRequest,
    UserClientAclListResponse,
    UserClientAclResponse,
    UserClientAclStatusRequest,
    UserClientAclUpdateRequest,
)
from services.auth_service import get_current_user
from services.user_client_acl_service import (
    change_user_client_acl_status,
    create_user_client_acl,
    delete_user_client_acl,
    get_user_client_acl,
    list_user_client_acls,
    update_user_client_acl,
)

router = APIRouter(prefix="/user-client-acl", tags=["UserClientAcl"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.post("/list", response_model=UserClientAclListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: UserClientAclFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_user_client_acls(db, body)


@router.get(
    "/{user_id}/{client_id}",
    response_model=UserClientAclResponse,
    status_code=status.HTTP_200_OK,
)
def get_endpoint(
    user_id: str,
    client_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_user_client_acl(db, user_id=user_id, client_id=client_id)


@router.post("", response_model=UserClientAclResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: UserClientAclCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_user_client_acl(db, body, created_by_id=session.user_id)


@router.put(
    "/{user_id}/{client_id}",
    response_model=UserClientAclResponse,
    status_code=status.HTTP_200_OK,
)
def update_endpoint(
    user_id: str,
    client_id: str,
    body: UserClientAclUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_user_client_acl(db, user_id, client_id, body, updated_by_id=session.user_id)


@router.patch(
    "/{user_id}/{client_id}/status",
    response_model=UserClientAclResponse,
    status_code=status.HTTP_200_OK,
)
def status_endpoint(
    user_id: str,
    client_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
    body: UserClientAclStatusRequest | None = None,
):
    # Permite llamar con body o solo path + is_active en body (estándar del proyecto)
    if body is None:
        # si no viene body, FastAPI igual debería invalidar; este guard es defensivo
        raise ValueError("Body requerido")
    return change_user_client_acl_status(
        db,
        user_id=user_id,
        client_id=client_id,
        is_active=body.is_active,
        updated_by_id=session.user_id,
    )


@router.delete(
    "/{user_id}/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_endpoint(
    user_id: str,
    client_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_user_client_acl(db, user_id=user_id, client_id=client_id, deleted_by_id=session.user_id)
    return None
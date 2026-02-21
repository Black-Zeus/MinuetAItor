# routers/v1/user_clients.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.user_clients import (
    UserClientCreateRequest,
    UserClientFilterRequest,
    UserClientListResponse,
    UserClientStatusRequest,
    UserClientResponse,
    UserClientUpdateRequest,
)
from services.auth_service import get_current_user
from services.user_clients_service import (
    change_user_client_status,
    create_user_client,
    delete_user_client,
    get_user_client,
    list_user_clients,
    update_user_client,
)

router = APIRouter(prefix="/user-clients", tags=["UserClients"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.post("/list", response_model=UserClientListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: UserClientFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_user_clients(db, body)


@router.get("/{user_id}/{client_id}", response_model=UserClientResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    user_id: str,
    client_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_user_client(db, user_id, client_id)


@router.post("", response_model=UserClientResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: UserClientCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_user_client(db, body, created_by_id=session.user_id)


@router.put("/{user_id}/{client_id}", response_model=UserClientResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    user_id: str,
    client_id: str,
    body: UserClientUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_user_client(db, user_id, client_id, body, updated_by_id=session.user_id)


@router.patch("/{user_id}/{client_id}/status", response_model=UserClientResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    user_id: str,
    client_id: str,
    body: UserClientStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_user_client_status(db, user_id, client_id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{user_id}/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    user_id: str,
    client_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_user_client(db, user_id, client_id, deleted_by_id=session.user_id)
    return None
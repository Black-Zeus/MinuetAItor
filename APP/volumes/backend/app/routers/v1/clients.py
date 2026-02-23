# routers/v1/clients.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.clients import (
    ClientCreateRequest,
    ClientFilterRequest,
    ClientListResponse,
    ClientResponse,
    ClientStatusRequest,
    ClientUpdateRequest,
)
from services.auth_service import get_current_user
from services.clients_service import (
    change_client_status,
    create_client,
    delete_client,
    get_client,
    list_clients,
    update_client,
)

router = APIRouter(prefix="/clients", tags=["Clients"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/industries", response_model=list[str], status_code=status.HTTP_200_OK)
def industries_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    """
    Devuelve todas las industrias distintas presentes en clientes,
    normalizadas a title case español.
    """
    from services.clients_service import list_industries
    return list_industries(db)

@router.get("/{id}", response_model=ClientResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_client(db, id)


@router.post("/list", response_model=ClientListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: ClientFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_clients(db, body)


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: ClientCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_client(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=ClientResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: ClientUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_client(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=ClientResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: str,
    body: ClientStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_client_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_client(db, id, deleted_by_id=session.user_id)
    return None

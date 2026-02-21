# routers/v1/user_sessions.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession as UserSessionJWT
from schemas.user_sessions import (
    UserSessionsCreateRequest,
    UserSessionsFilterRequest,
    UserSessionsListResponse,
    UserSessionsResponse,
    UserSessionsUpdateRequest,
)
from services.auth_service import get_current_user
from services.user_sessions_service import (
    create_user_session,
    delete_user_session,
    get_user_session,
    list_user_sessions,
    update_user_session,
)

router = APIRouter(prefix="/user-sessions", tags=["User Sessions"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSessionJWT:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=UserSessionsResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSessionJWT = Depends(current_user_dep),
):
    return get_user_session(db, id)


# CRÍTICO: /list antes que POST ""
@router.post("/list", response_model=UserSessionsListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: UserSessionsFilterRequest,
    db: Session = Depends(get_db),
    session: UserSessionJWT = Depends(current_user_dep),
):
    return list_user_sessions(db, body)


@router.post("", response_model=UserSessionsResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: UserSessionsCreateRequest,
    db: Session = Depends(get_db),
    session: UserSessionJWT = Depends(current_user_dep),
):
    return create_user_session(db, body)


@router.put("/{id}", response_model=UserSessionsResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: UserSessionsUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSessionJWT = Depends(current_user_dep),
):
    return update_user_session(db, id, body)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSessionJWT = Depends(current_user_dep),
):
    delete_user_session(db, id)
    return None
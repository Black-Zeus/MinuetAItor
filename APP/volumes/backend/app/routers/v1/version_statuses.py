# routers/v1/version_statuses.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from services.auth_service import get_current_user
from schemas.version_statuses import (
    VersionStatusCreateRequest,
    VersionStatusFilterRequest,
    VersionStatusListResponse,
    VersionStatusResponse,
    VersionStatusStatusRequest,
    VersionStatusUpdateRequest,
)
from services.version_statuses_service import (
    change_version_status_status,
    create_version_status,
    delete_version_status,
    get_version_status,
    list_version_statuses,
    update_version_status,
)

router = APIRouter(prefix="/version_statuses", tags=["Version Statuses"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=VersionStatusResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_version_status(db, id)


@router.post("/list", response_model=VersionStatusListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: VersionStatusFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_version_statuses(db, body)


@router.post("", response_model=VersionStatusResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: VersionStatusCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_version_status(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=VersionStatusResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: VersionStatusUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_version_status(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=VersionStatusResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: int,
    body: VersionStatusStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_version_status_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_version_status(db, id, deleted_by_id=session.user_id)
    return None
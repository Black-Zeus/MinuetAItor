# routers/v1/record_statuses.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.record_statuses import (
    RecordStatusCreateRequest,
    RecordStatusFilterRequest,
    RecordStatusListResponse,
    RecordStatusResponse,
    RecordStatusStatusRequest,
    RecordStatusUpdateRequest,
)
from services.auth_service import get_current_user
from services.record_statuses_service import (
    change_record_status_status,
    create_record_status,
    delete_record_status,
    get_record_status,
    list_record_statuses,
    update_record_status,
)

router = APIRouter(prefix="/record_statuses", tags=["RecordStatuses"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=RecordStatusResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    _ = session
    return get_record_status(db, id)


@router.post("/list", response_model=RecordStatusListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: RecordStatusFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    _ = session
    return list_record_statuses(db, body)


@router.post("", response_model=RecordStatusResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: RecordStatusCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_record_status(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=RecordStatusResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: RecordStatusUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_record_status(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=RecordStatusResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: int,
    body: RecordStatusStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_record_status_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_record_status(db, id, deleted_by_id=session.user_id)
    return None
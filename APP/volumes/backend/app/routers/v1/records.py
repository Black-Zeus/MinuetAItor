# routers/v1/records.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from services.auth_service import get_current_user

from schemas.records import (
    RecordCreateRequest,
    RecordUpdateRequest,
    RecordFilterRequest,
    RecordChangeStatusRequest,
    RecordResponse,
    RecordListResponse,
)
from services.records_service import (
    get_record,
    list_records,
    create_record,
    update_record,
    change_record_status,
    delete_record,
)

router = APIRouter(prefix="/records", tags=["Records"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=RecordResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_record(db, id)


@router.post("/list", response_model=RecordListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: RecordFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_records(db, body)


@router.post("", response_model=RecordResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: RecordCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_record(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=RecordResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: RecordUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_record(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=RecordResponse, status_code=status.HTTP_200_OK)
def change_status_endpoint(
    id: str,
    body: RecordChangeStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_record_status(db, id, status_id=body.status_id, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_record(db, id, deleted_by_id=session.user_id)
    return None
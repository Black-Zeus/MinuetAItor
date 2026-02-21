# routers/v1/record_types.py

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.record_types import (
    RecordTypeCreateRequest,
    RecordTypeFilterRequest,
    RecordTypeListResponse,
    RecordTypeResponse,
    RecordTypeStatusRequest,
    RecordTypeUpdateRequest,
)
from services.auth_service import get_current_user
from services.record_types_service import (
    change_record_type_status,
    create_record_type,
    delete_record_type,
    get_record_type,
    list_record_types,
    update_record_type,
)

router = APIRouter(prefix="/record_types", tags=["RecordTypes"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=RecordTypeResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_record_type(db, id)


@router.post("/list", response_model=RecordTypeListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: RecordTypeFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_record_types(db, body)


@router.post("", response_model=RecordTypeResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: RecordTypeCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_record_type(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=RecordTypeResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: RecordTypeUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_record_type(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=RecordTypeResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: int,
    body: RecordTypeStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_record_type_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_record_type(db, id, deleted_by_id=session.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
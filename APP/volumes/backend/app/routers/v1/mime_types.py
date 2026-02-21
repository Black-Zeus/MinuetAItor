# routers/v1/mime_types.py
from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.mime_types import (
    MimeTypeCreateRequest,
    MimeTypeFilterRequest,
    MimeTypeListResponse,
    MimeTypeResponse,
    MimeTypeStatusRequest,
    MimeTypeUpdateRequest,
)
from services.auth_service import get_current_user
from services.mime_types_service import (
    change_mime_type_status,
    create_mime_type,
    delete_mime_type,
    get_mime_type,
    list_mime_types,
    update_mime_type,
)

router = APIRouter(prefix="/mime-types", tags=["MimeTypes"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=MimeTypeResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_mime_type(db, id)


@router.post("/list", response_model=MimeTypeListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: MimeTypeFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_mime_types(db, body)


@router.post("", response_model=MimeTypeResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: MimeTypeCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_mime_type(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=MimeTypeResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: MimeTypeUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_mime_type(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=MimeTypeResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: int,
    body: MimeTypeStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_mime_type_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_mime_type(db, id, deleted_by_id=session.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
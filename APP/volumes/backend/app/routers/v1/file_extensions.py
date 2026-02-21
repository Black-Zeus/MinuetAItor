from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.file_extensions import (
    FileExtensionCreateRequest,
    FileExtensionFilterRequest,
    FileExtensionListResponse,
    FileExtensionResponse,
    FileExtensionStatusRequest,
    FileExtensionUpdateRequest,
)
from services.auth_service import get_current_user
from services.file_extensions_service import (
    change_file_extension_status,
    create_file_extension,
    delete_file_extension,
    get_file_extension,
    list_file_extensions,
    update_file_extension,
)

router = APIRouter(prefix="/file-extensions", tags=["FileExtensions"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=FileExtensionResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_file_extension(db, id)


@router.post("/list", response_model=FileExtensionListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: FileExtensionFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_file_extensions(db, body)


@router.post("", response_model=FileExtensionResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: FileExtensionCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_file_extension(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=FileExtensionResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: FileExtensionUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_file_extension(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=FileExtensionResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: int,
    body: FileExtensionStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_file_extension_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_file_extension(db, id, deleted_by_id=session.user_id)
    return None
# routers/v1/mime_type_extensions.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.mime_type_extensions import (
    MimeTypeExtensionCreateRequest,
    MimeTypeExtensionFilterRequest,
    MimeTypeExtensionListResponse,
    MimeTypeExtensionResponse,
    MimeTypeExtensionStatusRequest,
    MimeTypeExtensionUpdateRequest,
)
from services.auth_service import get_current_user
from services.mime_type_extensions_service import (
    change_mime_type_extension_status,
    create_mime_type_extension,
    delete_mime_type_extension,
    get_mime_type_extension,
    list_mime_type_extensions,
    update_mime_type_extension,
)

router = APIRouter(prefix="/mime-type-extensions", tags=["MimeTypeExtensions"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get(
    "/{mime_type_id}/{file_extension_id}",
    response_model=MimeTypeExtensionResponse,
    status_code=status.HTTP_200_OK,
)
def get_endpoint(
    mime_type_id: int,
    file_extension_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_mime_type_extension(db, mime_type_id=mime_type_id, file_extension_id=file_extension_id)


# CRÍTICO: /list antes que POST "" para evitar colisión con path params
@router.post(
    "/list",
    response_model=MimeTypeExtensionListResponse,
    status_code=status.HTTP_200_OK,
)
def list_endpoint(
    body: MimeTypeExtensionFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_mime_type_extensions(db, body)


@router.post(
    "",
    response_model=MimeTypeExtensionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_endpoint(
    body: MimeTypeExtensionCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_mime_type_extension(db, body, created_by_id=session.user_id)


@router.put(
    "/{mime_type_id}/{file_extension_id}",
    response_model=MimeTypeExtensionResponse,
    status_code=status.HTTP_200_OK,
)
def update_endpoint(
    mime_type_id: int,
    file_extension_id: int,
    body: MimeTypeExtensionUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_mime_type_extension(
        db,
        mime_type_id=mime_type_id,
        file_extension_id=file_extension_id,
        body=body,
        updated_by_id=session.user_id,
    )


@router.patch(
    "/{mime_type_id}/{file_extension_id}/status",
    response_model=MimeTypeExtensionResponse,
    status_code=status.HTTP_200_OK,
)
def status_endpoint(
    mime_type_id: int,
    file_extension_id: int,
    body: MimeTypeExtensionStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_mime_type_extension_status(
        db,
        mime_type_id=mime_type_id,
        file_extension_id=file_extension_id,
        is_active=body.is_active,
        updated_by_id=session.user_id,
    )


@router.delete(
    "/{mime_type_id}/{file_extension_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_endpoint(
    mime_type_id: int,
    file_extension_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_mime_type_extension(
        db,
        mime_type_id=mime_type_id,
        file_extension_id=file_extension_id,
        deleted_by_id=session.user_id,
    )
    return None
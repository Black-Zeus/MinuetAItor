from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.artifact_type_mime_types import (
    ArtifactTypeMimeTypeCreateRequest,
    ArtifactTypeMimeTypeFilterRequest,
    ArtifactTypeMimeTypeListResponse,
    ArtifactTypeMimeTypeResponse,
    ArtifactTypeMimeTypeStatusRequest,
    ArtifactTypeMimeTypeUpdateRequest,
)
from services.auth_service import get_current_user
from services.artifact_type_mime_types_service import (
    change_artifact_type_mime_type_status,
    create_artifact_type_mime_type,
    delete_artifact_type_mime_type,
    get_artifact_type_mime_type,
    list_artifact_type_mime_types,
    update_artifact_type_mime_type,
)

router = APIRouter(prefix="/artifact-type-mime-types", tags=["ArtifactTypeMimeTypes"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.post("/list", response_model=ArtifactTypeMimeTypeListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: ArtifactTypeMimeTypeFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_artifact_type_mime_types(db, body)


@router.get(
    "/{artifact_type_id}/{mime_type_id}",
    response_model=ArtifactTypeMimeTypeResponse,
    status_code=status.HTTP_200_OK,
)
def get_endpoint(
    artifact_type_id: int,
    mime_type_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_artifact_type_mime_type(db, artifact_type_id, mime_type_id)


@router.post("", response_model=ArtifactTypeMimeTypeResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: ArtifactTypeMimeTypeCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_artifact_type_mime_type(db, body, created_by_id=session.user_id)


@router.put(
    "/{artifact_type_id}/{mime_type_id}",
    response_model=ArtifactTypeMimeTypeResponse,
    status_code=status.HTTP_200_OK,
)
def update_endpoint(
    artifact_type_id: int,
    mime_type_id: int,
    body: ArtifactTypeMimeTypeUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_artifact_type_mime_type(
        db,
        artifact_type_id,
        mime_type_id,
        body,
        updated_by_id=session.user_id,
    )


@router.patch("/status", response_model=ArtifactTypeMimeTypeResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    body: ArtifactTypeMimeTypeStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_artifact_type_mime_type_status(
        db,
        body.artifact_type_id,
        body.mime_type_id,
        is_active=body.is_active,
        updated_by_id=session.user_id,
    )


@router.delete(
    "/{artifact_type_id}/{mime_type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_endpoint(
    artifact_type_id: int,
    mime_type_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_artifact_type_mime_type(db, artifact_type_id, mime_type_id, deleted_by_id=session.user_id)
    return None
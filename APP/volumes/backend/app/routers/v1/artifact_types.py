# routers/v1/artifact_types.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.artifact_types import (
    ArtifactTypeCreateRequest,
    ArtifactTypeFilterRequest,
    ArtifactTypeListResponse,
    ArtifactTypeResponse,
    ArtifactTypeStatusRequest,
    ArtifactTypeUpdateRequest,
)
from services.auth_service import get_current_user
from services.artifact_types_service import (
    change_artifact_type_status,
    create_artifact_type,
    delete_artifact_type,
    get_artifact_type,
    list_artifact_types,
    update_artifact_type,
)

router = APIRouter(prefix="/artifact-types", tags=["Artifact Types"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=ArtifactTypeResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_artifact_type(db, id)


@router.post("/list", response_model=ArtifactTypeListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: ArtifactTypeFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_artifact_types(db, body)


@router.post("", response_model=ArtifactTypeResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: ArtifactTypeCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_artifact_type(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=ArtifactTypeResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: ArtifactTypeUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_artifact_type(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=ArtifactTypeResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: int,
    body: ArtifactTypeStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_artifact_type_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_artifact_type(db, id, deleted_by_id=session.user_id)
    return None
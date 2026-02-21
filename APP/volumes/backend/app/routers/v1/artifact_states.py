# routers/v1/artifact_states.py

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.artifact_states import (
    ArtifactStateCreateRequest,
    ArtifactStateFilterRequest,
    ArtifactStateListResponse,
    ArtifactStateResponse,
    ArtifactStateStatusRequest,
    ArtifactStateUpdateRequest,
)
from services.auth_service import get_current_user
from services.artifact_states_service import (
    change_artifact_state_status,
    create_artifact_state,
    delete_artifact_state,
    get_artifact_state,
    list_artifact_states,
    update_artifact_state,
)

router = APIRouter(prefix="/artifact_states", tags=["Artifact States"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=ArtifactStateResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_artifact_state(db, id)


@router.post("/list", response_model=ArtifactStateListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: ArtifactStateFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_artifact_states(db, body)


@router.post("", response_model=ArtifactStateResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: ArtifactStateCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_artifact_state(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=ArtifactStateResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: ArtifactStateUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_artifact_state(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=ArtifactStateResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: int,
    body: ArtifactStateStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_artifact_state_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_artifact_state(db, id, deleted_by_id=session.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
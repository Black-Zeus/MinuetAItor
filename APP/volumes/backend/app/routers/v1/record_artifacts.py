# routers/v1/record_artifacts.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.record_artifacts import (
    RecordArtifactCreateRequest,
    RecordArtifactFilterRequest,
    RecordArtifactListResponse,
    RecordArtifactResponse,
    RecordArtifactUpdateRequest,
)
from services.auth_service import get_current_user
from services.record_artifacts_service import (
    create_record_artifact,
    delete_record_artifact,
    get_record_artifact,
    list_record_artifacts,
    update_record_artifact,
)

router = APIRouter(prefix="/record-artifacts", tags=["RecordArtifacts"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=RecordArtifactResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    _ = session
    return get_record_artifact(db, id)


@router.post("/list", response_model=RecordArtifactListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: RecordArtifactFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    _ = session
    return list_record_artifacts(db, body)


@router.post("", response_model=RecordArtifactResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: RecordArtifactCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_record_artifact(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=RecordArtifactResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: RecordArtifactUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    _ = session
    return update_record_artifact(db, id, body)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_record_artifact(db, id, deleted_by_id=session.user_id)
    return None
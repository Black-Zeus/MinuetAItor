# routers/v1/record_version_commits.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.record_version_commits import (
    RecordVersionCommitCreateRequest,
    RecordVersionCommitFilterRequest,
    RecordVersionCommitListResponse,
    RecordVersionCommitResponse,
)
from services.auth_service import get_current_user
from services.record_version_commits_service import (
    create_record_version_commit,
    get_record_version_commit,
    list_record_version_commits,
)

router = APIRouter(prefix="/record-version-commits", tags=["RecordVersionCommits"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=RecordVersionCommitResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_record_version_commit(db, id)


# CRÍTICO: /list antes que POST ""
@router.post("/list", response_model=RecordVersionCommitListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: RecordVersionCommitFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_record_version_commits(db, body)


@router.post("", response_model=RecordVersionCommitResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: RecordVersionCommitCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_record_version_commit(db, body, actor_user_id=session.user_id)

# PUT eliminado — los commits son registros históricos inmutables.
# DELETE eliminado — los commits no se eliminan; son parte del historial de auditoría.
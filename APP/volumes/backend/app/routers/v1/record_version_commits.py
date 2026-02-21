# routers/v1/record_version_commits.py

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
    RecordVersionCommitUpdateRequest,
)
from services.auth_service import get_current_user
from services.record_version_commits_service import (
    create_record_version_commit,
    delete_record_version_commit,
    get_record_version_commit,
    list_record_version_commits,
    update_record_version_commit,
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


@router.put("/{id}", response_model=RecordVersionCommitResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: RecordVersionCommitUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_record_version_commit(db, id, body)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_record_version_commit(db, id, deleted_by_id=session.user_id)
    return None
# routers/v1/record_versions.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.record_versions import (
    RecordVersionCreateRequest,
    RecordVersionFilterRequest,
    RecordVersionListResponse,
    RecordVersionResponse,
    RecordVersionUpdateRequest,
)
from services.auth_service import get_current_user
from services.record_versions_service import (
    create_record_version,
    delete_record_version,
    get_record_version,
    list_record_versions,
    update_record_version,
)

router = APIRouter(prefix="/record-versions", tags=["RecordVersions"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=RecordVersionResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_record_version(db, id)


# CRÍTICO: declarar /list antes que POST ""
@router.post("/list", response_model=RecordVersionListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: RecordVersionFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_record_versions(db, body)


@router.post("", response_model=RecordVersionResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: RecordVersionCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_record_version(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=RecordVersionResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: RecordVersionUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_record_version(db, id, body, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_record_version(db, id, deleted_by_id=session.user_id)
    return None
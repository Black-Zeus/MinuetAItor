# routers/v1/record_drafts.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.record_drafts import (
    RecordDraftCreateRequest,
    RecordDraftFilterRequest,
    RecordDraftListResponse,
    RecordDraftResponse,
    RecordDraftUpdateRequest,
)
from services.auth_service import get_current_user
from services.record_drafts_service import (
    create_record_draft,
    delete_record_draft,
    get_record_draft,
    list_record_drafts,
    update_record_draft,
)

router = APIRouter(prefix="/record-drafts", tags=["RecordDrafts"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=RecordDraftResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_record_draft(db, id)


@router.post("/list", response_model=RecordDraftListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: RecordDraftFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_record_drafts(db, body)


@router.post("", response_model=RecordDraftResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: RecordDraftCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_record_draft(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=RecordDraftResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: RecordDraftUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_record_draft(db, id, body, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_record_draft(db, id, deleted_by_id=session.user_id)
    return None
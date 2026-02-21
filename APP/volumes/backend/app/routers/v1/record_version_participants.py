# routers/v1/record_version_participants.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from services.auth_service import get_current_user

from schemas.record_version_participant import (
    RecordVersionParticipantCreateRequest,
    RecordVersionParticipantFilterRequest,
    RecordVersionParticipantListResponse,
    RecordVersionParticipantResponse,
    RecordVersionParticipantUpdateRequest,
)
from services.record_version_participant_service import (
    create_record_version_participant,
    delete_record_version_participant,
    get_record_version_participant,
    list_record_version_participants,
    update_record_version_participant,
)

router = APIRouter(prefix="/record-version-participants", tags=["RecordVersionParticipants"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=RecordVersionParticipantResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_record_version_participant(db, id)


# CRÍTICO: declarar /list antes que POST "" para evitar colisión de path
@router.post("/list", response_model=RecordVersionParticipantListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: RecordVersionParticipantFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_record_version_participants(db, body)


@router.post("", response_model=RecordVersionParticipantResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: RecordVersionParticipantCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_record_version_participant(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=RecordVersionParticipantResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: RecordVersionParticipantUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_record_version_participant(db, id, body, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_record_version_participant(db, id)
    return None
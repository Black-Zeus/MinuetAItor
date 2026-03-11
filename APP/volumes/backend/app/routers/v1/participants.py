# routers/v1/participants.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.participants import (
    ParticipantEmailLookupRequest,
    ParticipantEmailLookupResponse,
    ParticipantFilterRequest,
    ParticipantListResponse,
    ParticipantResolveRequest,
    ParticipantResponse,
)
from services.auth_service import get_current_user
from services.participants_service import (
    get_participant,
    lookup_participant_emails,
    list_participants,
    resolve_participant,
    soft_delete_participant,
)

router = APIRouter(prefix="/participants", tags=["Participants"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=ParticipantResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_participant(db, id)


@router.post("/list", response_model=ParticipantListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: ParticipantFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_participants(db, body)


@router.post("/emails/lookup", response_model=ParticipantEmailLookupResponse, status_code=status.HTTP_200_OK)
def lookup_emails_endpoint(
    body: ParticipantEmailLookupRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return lookup_participant_emails(db, body)


@router.post("/resolve", response_model=ParticipantResponse, status_code=status.HTTP_200_OK)
def resolve_endpoint(
    body: ParticipantResolveRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return resolve_participant(db, body, actor_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    soft_delete_participant(db, id, actor_id=session.user_id)
    return None

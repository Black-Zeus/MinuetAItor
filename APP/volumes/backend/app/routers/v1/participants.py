# routers/v1/participants.py
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from services.upload_validation import safe_content_disposition
from schemas.participants import (
    ParticipantCreateRequest,
    ParticipantEmailLookupRequest,
    ParticipantEmailLookupResponse,
    ParticipantFilterRequest,
    ParticipantListResponse,
    ParticipantResolveRequest,
    ParticipantResponse,
    ParticipantStatusRequest,
    ParticipantUpdateRequest,
)
from services.auth_service import get_current_user
from services.participants_service import (
    change_participant_status,
    create_participant,
    delete_participant_logo,
    get_participant,
    lookup_participant_emails,
    list_participants,
    read_participant_logo_content,
    resolve_participant,
    soft_delete_participant,
    upload_participant_logo,
    update_participant,
)

router = APIRouter(prefix="/participants", tags=["Participants"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}/logo", status_code=status.HTTP_200_OK)
def logo_endpoint(
    id: str,
    db: Session = Depends(get_db),
):
    content, content_type = read_participant_logo_content(db, id)
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": safe_content_disposition("participant-logo", disposition="inline"),
            "X-Content-Type-Options": "nosniff",
        },
    )


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


@router.post("", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: ParticipantCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_participant(db, body, actor_id=session.user_id)


@router.post("/{id}/logo", status_code=status.HTTP_200_OK)
async def upload_logo_endpoint(
    id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return await upload_participant_logo(db, id, file, actor_id=session.user_id)


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


@router.put("/{id}", response_model=ParticipantResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: ParticipantUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_participant(db, id, body, actor_id=session.user_id)


@router.patch("/{id}/status", response_model=ParticipantResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: str,
    body: ParticipantStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_participant_status(db, id, body, actor_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    soft_delete_participant(db, id, actor_id=session.user_id)
    return None


@router.delete("/{id}/logo", status_code=status.HTTP_200_OK)
def delete_logo_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return delete_participant_logo(db, id, actor_id=session.user_id)

# routers/v1/ai_profiles.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.ai_profiles import (
    AiProfileCreateRequest,
    AiProfileFilterRequest,
    AiProfileListResponse,
    AiProfileResponse,
    AiProfileStatusRequest,
    AiProfileUpdateRequest,
)
from schemas.auth import UserSession
from services.ai_profiles_service import (
    change_ai_profile_status,
    create_ai_profile,
    delete_ai_profile,
    get_ai_profile,
    list_ai_profiles,
    update_ai_profile,
)
from services.auth_service import get_current_user

router = APIRouter(prefix="/ai-profiles", tags=["AI Profiles"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=AiProfileResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_ai_profile(db, id)


# CRÍTICO: /list antes que POST ""
@router.post("/list", response_model=AiProfileListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: AiProfileFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_ai_profiles(db, body)


@router.post("", response_model=AiProfileResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: AiProfileCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_ai_profile(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=AiProfileResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: AiProfileUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_ai_profile(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=AiProfileResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: str,
    body: AiProfileStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_ai_profile_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_ai_profile(db, id, deleted_by_id=session.user_id)
    return None

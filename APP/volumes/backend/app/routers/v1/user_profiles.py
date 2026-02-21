# routers/v1/user_profiles.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.user_profiles import (
    UserProfileCreateRequest,
    UserProfileFilterRequest,
    UserProfileListResponse,
    UserProfileResponse,
    UserProfileUpdateRequest,
)
from services.auth_service import get_current_user
from services.user_profiles_service import (
    create_user_profile,
    delete_user_profile,
    get_user_profile,
    list_user_profiles,
    update_user_profile,
)

router = APIRouter(prefix="/user-profiles", tags=["UserProfiles"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{user_id}", response_model=UserProfileResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    user_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_user_profile(db, user_id)


@router.post("/list", response_model=UserProfileListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: UserProfileFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_user_profiles(db, body)


@router.post("", response_model=UserProfileResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: UserProfileCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_user_profile(db, body)


@router.put("/{user_id}", response_model=UserProfileResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    user_id: str,
    body: UserProfileUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_user_profile(db, user_id, body)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    user_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_user_profile(db, user_id)
    return None
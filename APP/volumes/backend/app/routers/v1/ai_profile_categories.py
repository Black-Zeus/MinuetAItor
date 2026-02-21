# routers/v1/ai_profile_categories.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.ai_profile_categories import (
    AiProfileCategoryCreateRequest,
    AiProfileCategoryFilterRequest,
    AiProfileCategoryListResponse,
    AiProfileCategoryResponse,
    AiProfileCategoryStatusRequest,
    AiProfileCategoryUpdateRequest,
)
from services.auth_service import get_current_user
from services.ai_profile_categories_service import (
    change_ai_profile_category_status,
    create_ai_profile_category,
    delete_ai_profile_category,
    get_ai_profile_category,
    list_ai_profile_categories,
    update_ai_profile_category,
)

router = APIRouter(prefix="/ai-profile-categories", tags=["AI Profile Categories"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=AiProfileCategoryResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_ai_profile_category(db, id)


# CRÍTICO: /list antes que POST base
@router.post("/list", response_model=AiProfileCategoryListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: AiProfileCategoryFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_ai_profile_categories(db, body)


@router.post("", response_model=AiProfileCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: AiProfileCategoryCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_ai_profile_category(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=AiProfileCategoryResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: AiProfileCategoryUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_ai_profile_category(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=AiProfileCategoryResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: int,
    body: AiProfileCategoryStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_ai_profile_category_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_ai_profile_category(db, id, deleted_by_id=session.user_id)
    return None

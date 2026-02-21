# routers/v1/ai_tag_conversions.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.ai_tag_conversions import (
    AiTagConversionCreateRequest,
    AiTagConversionFilterRequest,
    AiTagConversionListResponse,
    AiTagConversionResponse,
    AiTagConversionUpdateRequest,
)
from services.auth_service import get_current_user
from services.ai_tag_conversions_service import (
    create_ai_tag_conversion,
    delete_ai_tag_conversion,
    get_ai_tag_conversion,
    list_ai_tag_conversions,
    update_ai_tag_conversion,
)

router = APIRouter(prefix="/ai_tag_conversions", tags=["AI Tag Conversions"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.post("/list", response_model=AiTagConversionListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: AiTagConversionFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_ai_tag_conversions(db, body)


@router.post("", response_model=AiTagConversionResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: AiTagConversionCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_ai_tag_conversion(db, body, created_by_id=session.user_id)


@router.get("/{ai_tag_id}/{tag_id}", response_model=AiTagConversionResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    ai_tag_id: str,
    tag_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_ai_tag_conversion(db, ai_tag_id, tag_id)


@router.put("/{ai_tag_id}/{tag_id}", response_model=AiTagConversionResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    ai_tag_id: str,
    tag_id: str,
    body: AiTagConversionUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_ai_tag_conversion(db, ai_tag_id, tag_id, body, updated_by_id=session.user_id)


@router.delete("/{ai_tag_id}/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    ai_tag_id: str,
    tag_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_ai_tag_conversion(db, ai_tag_id, tag_id)
    return None
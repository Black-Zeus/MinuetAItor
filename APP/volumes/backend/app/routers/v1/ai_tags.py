# routers/v1/ai_tags.py
from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.ai_tags import (
    AITagCreateRequest,
    AITagFilterRequest,
    AITagListResponse,
    AITagResponse,
    AITagStatusRequest,
    AITagUpdateRequest,
)
from schemas.auth import UserSession
from services.ai_tags_service import (
    change_ai_tag_status,
    create_ai_tag,
    delete_ai_tag,
    get_ai_tag,
    list_ai_tags,
    update_ai_tag,
)
from services.auth_service import get_current_user

router = APIRouter(prefix="/ai-tags", tags=["AI Tags"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=AITagResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_ai_tag(db, id)


# CRÍTICO: /list antes que POST ""
@router.post("/list", response_model=AITagListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: AITagFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_ai_tags(db, body)


@router.post("", response_model=AITagResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: AITagCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_ai_tag(db, body)


@router.put("/{id}", response_model=AITagResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: AITagUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_ai_tag(db, id, body)


@router.patch("/{id}/status", response_model=AITagResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: str,
    body: AITagStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_ai_tag_status(db, id, is_active=body.is_active)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_ai_tag(db, id)
    return None

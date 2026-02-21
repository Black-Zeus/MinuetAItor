# routers/v1/tags.py
from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.tags import (
    TagCreateRequest,
    TagFilterRequest,
    TagListResponse,
    TagResponse,
    TagStatusRequest,
    TagUpdateRequest,
)
from services.auth_service import get_current_user
from services.tags_service import (
    change_tag_status,
    create_tag,
    delete_tag,
    get_tag,
    list_tags,
    update_tag,
)

router = APIRouter(prefix="/tags", tags=["Tags"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=TagResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_tag(db, id)


# CRÍTICO: /list antes que POST ""
@router.post("/list", response_model=TagListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: TagFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_tags(db, body)


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: TagCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_tag(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=TagResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: TagUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_tag(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=TagResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: str,
    body: TagStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_tag_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_tag(db, id, deleted_by_id=session.user_id)
    return None

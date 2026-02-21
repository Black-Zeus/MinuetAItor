# routers/v1/record_version_ai_tags.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.record_version_ai_tags import (
    RecordVersionAiTagCreateRequest,
    RecordVersionAiTagFilterRequest,
    RecordVersionAiTagListResponse,
    RecordVersionAiTagResponse,
    RecordVersionAiTagUpdateRequest,
)
from services.auth_service import get_current_user
from services.record_version_ai_tags_service import (
    create_record_version_ai_tag,
    delete_record_version_ai_tag,
    get_record_version_ai_tag,
    list_record_version_ai_tags,
    update_record_version_ai_tag,
)

router = APIRouter(prefix="/record-version-ai-tags", tags=["RecordVersionAiTags"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get(
    "/{record_version_id}/{ai_tag_id}",
    response_model=RecordVersionAiTagResponse,
    status_code=status.HTTP_200_OK,
)
def get_endpoint(
    record_version_id: str,
    ai_tag_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_record_version_ai_tag(db, record_version_id, ai_tag_id)


@router.post(
    "/list",
    response_model=RecordVersionAiTagListResponse,
    status_code=status.HTTP_200_OK,
)
def list_endpoint(
    body: RecordVersionAiTagFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_record_version_ai_tags(db, body)


@router.post(
    "",
    response_model=RecordVersionAiTagResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_endpoint(
    body: RecordVersionAiTagCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_record_version_ai_tag(db, body)


@router.put(
    "/{record_version_id}/{ai_tag_id}",
    response_model=RecordVersionAiTagResponse,
    status_code=status.HTTP_200_OK,
)
def update_endpoint(
    record_version_id: str,
    ai_tag_id: str,
    body: RecordVersionAiTagUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_record_version_ai_tag(db, record_version_id, ai_tag_id, body)


@router.delete(
    "/{record_version_id}/{ai_tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_endpoint(
    record_version_id: str,
    ai_tag_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_record_version_ai_tag(db, record_version_id, ai_tag_id)
    return None
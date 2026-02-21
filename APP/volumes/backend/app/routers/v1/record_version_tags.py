# routers/v1/record_version_tags.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.record_version_tags import (
    RecordVersionTagCreateRequest,
    RecordVersionTagFilterRequest,
    RecordVersionTagListResponse,
    RecordVersionTagResponse,
)
from services.auth_service import get_current_user
from services.record_version_tags_service import (
    create_record_version_tag,
    delete_record_version_tag,
    get_record_version_tag,
    list_record_version_tags,
)

router = APIRouter(prefix="/record-version-tags", tags=["RecordVersionTags"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


# CRÍTICO: /list antes que rutas con path params
@router.post("/list", response_model=RecordVersionTagListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: RecordVersionTagFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_record_version_tags(db, body)


@router.get(
    "/{record_version_id}/{tag_id}",
    response_model=RecordVersionTagResponse,
    status_code=status.HTTP_200_OK,
)
def get_endpoint(
    record_version_id: str,
    tag_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_record_version_tag(db, record_version_id, tag_id)


@router.post("", response_model=RecordVersionTagResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: RecordVersionTagCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_record_version_tag(db, body, added_by_id=session.user_id)


@router.delete(
    "/{record_version_id}/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_endpoint(
    record_version_id: str,
    tag_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_record_version_tag(db, record_version_id, tag_id)
    return None

# PUT (touch) eliminado — no se debe poder reeditar quién o cuándo añadió una etiqueta.
# La relación versión ↔ tag solo admite POST y DELETE.
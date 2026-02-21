# routers/v1/user_project_acl.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.user_project_acl import (
    UserProjectACLCreateRequest,
    UserProjectACLFilterRequest,
    UserProjectACLListResponse,
    UserProjectACLResponse,
    UserProjectACLStatusRequest,
    UserProjectACLUpdateRequest,
)
from services.auth_service import get_current_user
from services.user_project_acl_service import (
    change_user_project_acl_status,
    create_user_project_acl,
    delete_user_project_acl,
    get_user_project_acl,
    list_user_project_acls,
    update_user_project_acl,
)

router = APIRouter(prefix="/user-project-acl", tags=["UserProjectACL"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.post(
    "/list",
    response_model=UserProjectACLListResponse,
    status_code=status.HTTP_200_OK,
)
def list_endpoint(
    body: UserProjectACLFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_user_project_acls(db, body)


@router.get(
    "/{user_id}/{project_id}",
    response_model=UserProjectACLResponse,
    status_code=status.HTTP_200_OK,
)
def get_endpoint(
    user_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_user_project_acl(db, user_id, project_id)


@router.post(
    "",
    response_model=UserProjectACLResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_endpoint(
    body: UserProjectACLCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_user_project_acl(db, body, created_by_id=session.user_id)


@router.put(
    "/{user_id}/{project_id}",
    response_model=UserProjectACLResponse,
    status_code=status.HTTP_200_OK,
)
def update_endpoint(
    user_id: str,
    project_id: str,
    body: UserProjectACLUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_user_project_acl(db, user_id, project_id, body, updated_by_id=session.user_id)


@router.patch(
    "/{user_id}/{project_id}/status",
    response_model=UserProjectACLResponse,
    status_code=status.HTTP_200_OK,
)
def status_endpoint(
    user_id: str,
    project_id: str,
    body: UserProjectACLStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_user_project_acl_status(
        db,
        user_id,
        project_id,
        is_active=body.is_active,
        updated_by_id=session.user_id,
    )


@router.delete(
    "/{user_id}/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_endpoint(
    user_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_user_project_acl(db, user_id, project_id, deleted_by_id=session.user_id)
    return None
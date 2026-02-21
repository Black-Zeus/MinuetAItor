# routers/v1/projects.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.projects import (
    ProjectCreateRequest,
    ProjectFilterRequest,
    ProjectListResponse,
    ProjectResponse,
    ProjectStatusRequest,
    ProjectUpdateRequest,
)
from services.auth_service import get_current_user
from services.projects_service import (
    change_project_status,
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["Projects"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_project(db, id)


# CRÍTICO: /list antes que POST ""
@router.post("/list", response_model=ProjectListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: ProjectFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_projects(db, body)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: ProjectCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_project(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: ProjectUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_project(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: str,
    body: ProjectStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_project_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_project(db, id, deleted_by_id=session.user_id)
    return None

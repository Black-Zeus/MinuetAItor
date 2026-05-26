# routers/v1/projects.py
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.orm import Session

from core.authz import current_user_dep
from db.session import get_db
from schemas.auth import UserSession
from services.upload_validation import safe_content_disposition
from schemas.projects import (
    ProjectCreateRequest,
    ProjectFilterRequest,
    ProjectListResponse,
    ProjectResponse,
    ProjectStatusRequest,
    ProjectUpdateRequest,
)
from services.projects_service import (
    change_project_status,
    create_project,
    delete_project_logo,
    delete_project,
    get_project,
    list_projects,
    read_project_logo_content,
    upload_project_logo,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("/{id}/logo", status_code=status.HTTP_200_OK)
def logo_endpoint(
    id: str,
    db: Session = Depends(get_db),
):
    content, content_type = read_project_logo_content(db, id)
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": safe_content_disposition("project-logo", disposition="inline"),
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{id}", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_project(db, id, session)


# CRÍTICO: /list antes que POST ""
@router.post("/list", response_model=ProjectListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: ProjectFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_projects(db, body, session)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: ProjectCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_project(db, body, created_by_id=session.user_id, session=session)


@router.post("/{id}/logo", status_code=status.HTTP_200_OK)
async def upload_logo_endpoint(
    id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return await upload_project_logo(db, id, file, session)


@router.put("/{id}", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: ProjectUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_project(db, id, body, updated_by_id=session.user_id, session=session)


@router.patch("/{id}/status", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: str,
    body: ProjectStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_project_status(
        db,
        id,
        is_active=body.is_active,
        updated_by_id=session.user_id,
        session=session,
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_project(db, id, deleted_by_id=session.user_id, session=session)
    return None


@router.delete("/{id}/logo", status_code=status.HTTP_200_OK)
def delete_logo_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return delete_project_logo(db, id, session)

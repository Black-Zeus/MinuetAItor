# routers/v1/user_project_acl.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import require_roles
from db.session import get_db
from models.projects import Project
from models.user import User
from schemas.auth import UserSession
from schemas.user_project_acl import (
    UserProjectACLCreateRequest,
    UserProjectACLFilterRequest,
    UserProjectACLListResponse,
    UserProjectACLResponse,
    UserProjectACLStatusRequest,
    UserProjectACLUpdateRequest,
)
from services.user_project_acl_service import (
    change_user_project_acl_status,
    create_user_project_acl,
    delete_user_project_acl,
    get_user_project_acl,
    list_user_project_acls,
    update_user_project_acl,
)
from services.notification_service import enqueue_confidential_project_acl_notifications
from services.notification_center_service import create_in_app_notification

router = APIRouter(prefix="/user-project-acl", tags=["UserProjectACL"])


@router.post(
    "/list",
    response_model=UserProjectACLListResponse,
    status_code=status.HTTP_200_OK,
)
def list_endpoint(
    body: UserProjectACLFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
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
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return get_user_project_acl(db, user_id, project_id)


@router.post(
    "",
    response_model=UserProjectACLResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_endpoint(
    body: UserProjectACLCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    result = create_user_project_acl(db, body, created_by_id=session.user_id)
    target_user = db.query(User).filter(User.id == body.user_id, User.deleted_at.is_(None)).first()
    project = db.query(Project).filter(Project.id == body.project_id, Project.deleted_at.is_(None)).first()
    await enqueue_confidential_project_acl_notifications(
        db,
        user_id=body.user_id,
        project_id=body.project_id,
        action="granted",
        actor_user_id=session.user_id,
        reason="Asignacion o actualizacion de acceso confidencial.",
    )
    await create_in_app_notification(
        db,
        notification_type="acl.project.granted",
        title="Acceso a proyecto privado actualizado",
        message=(
            f'Se te otorgó acceso al proyecto privado "{getattr(project, "name", body.project_id)}" '
            f'con permiso "{result.get("permission", "read")}".'
        ),
        level="info",
        tags=["acl", "project", "private", "acl.project.granted"],
        recipient_user_ids=[body.user_id],
        scope_type="project",
        scope_id=body.project_id,
        action_url="/projects",
        actor_user_id=session.user_id,
        metadata={
            "projectId": body.project_id,
            "projectName": getattr(project, "name", None),
            "permission": result.get("permission"),
            "targetUserId": body.user_id,
            "targetUsername": getattr(target_user, "username", None),
        },
    )
    return result


@router.put(
    "/{user_id}/{project_id}",
    response_model=UserProjectACLResponse,
    status_code=status.HTTP_200_OK,
)
async def update_endpoint(
    user_id: str,
    project_id: str,
    body: UserProjectACLUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    result = update_user_project_acl(db, user_id, project_id, body, updated_by_id=session.user_id)
    target_user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    project = db.query(Project).filter(Project.id == project_id, Project.deleted_at.is_(None)).first()
    await enqueue_confidential_project_acl_notifications(
        db,
        user_id=user_id,
        project_id=project_id,
        action="granted" if result.get("isActive", True) else "revoked",
        actor_user_id=session.user_id,
        reason="Actualizacion de acceso confidencial.",
    )
    await create_in_app_notification(
        db,
        notification_type="acl.project.granted" if result.get("isActive", True) else "acl.project.revoked",
        title="Acceso a proyecto privado actualizado" if result.get("isActive", True) else "Acceso a proyecto privado revocado",
        message=(
            f'Se {"actualizó" if result.get("isActive", True) else "revocó"} tu acceso al proyecto privado '
            f'"{getattr(project, "name", project_id)}".'
        ),
        level="info" if result.get("isActive", True) else "warning",
        tags=["acl", "project", "private", "acl.project.granted" if result.get("isActive", True) else "acl.project.revoked"],
        recipient_user_ids=[user_id],
        scope_type="project",
        scope_id=project_id,
        action_url="/projects",
        actor_user_id=session.user_id,
        metadata={
            "projectId": project_id,
            "projectName": getattr(project, "name", None),
            "permission": result.get("permission"),
            "targetUserId": user_id,
            "targetUsername": getattr(target_user, "username", None),
            "isActive": result.get("isActive", True),
        },
    )
    return result


@router.patch(
    "/{user_id}/{project_id}/status",
    response_model=UserProjectACLResponse,
    status_code=status.HTTP_200_OK,
)
async def status_endpoint(
    user_id: str,
    project_id: str,
    body: UserProjectACLStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    result = change_user_project_acl_status(
        db,
        user_id,
        project_id,
        is_active=body.is_active,
        updated_by_id=session.user_id,
    )
    target_user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    project = db.query(Project).filter(Project.id == project_id, Project.deleted_at.is_(None)).first()
    await enqueue_confidential_project_acl_notifications(
        db,
        user_id=user_id,
        project_id=project_id,
        action="granted" if body.is_active else "revoked",
        actor_user_id=session.user_id,
        reason="Cambio de estado de acceso confidencial.",
    )
    await create_in_app_notification(
        db,
        notification_type="acl.project.granted" if body.is_active else "acl.project.revoked",
        title="Acceso a proyecto privado activado" if body.is_active else "Acceso a proyecto privado revocado",
        message=(
            f'Se {"activó" if body.is_active else "revocó"} tu acceso al proyecto privado '
            f'"{getattr(project, "name", project_id)}".'
        ),
        level="info" if body.is_active else "warning",
        tags=["acl", "project", "private", "acl.project.granted" if body.is_active else "acl.project.revoked"],
        recipient_user_ids=[user_id],
        scope_type="project",
        scope_id=project_id,
        action_url="/projects",
        actor_user_id=session.user_id,
        metadata={
            "projectId": project_id,
            "projectName": getattr(project, "name", None),
            "targetUserId": user_id,
            "targetUsername": getattr(target_user, "username", None),
            "isActive": body.is_active,
        },
    )
    return result


@router.delete(
    "/{user_id}/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_endpoint(
    user_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    delete_user_project_acl(db, user_id, project_id, deleted_by_id=session.user_id)
    target_user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    project = db.query(Project).filter(Project.id == project_id, Project.deleted_at.is_(None)).first()
    await enqueue_confidential_project_acl_notifications(
        db,
        user_id=user_id,
        project_id=project_id,
        action="revoked",
        actor_user_id=session.user_id,
        reason="Acceso confidencial eliminado.",
    )
    await create_in_app_notification(
        db,
        notification_type="acl.project.revoked",
        title="Acceso a proyecto privado revocado",
        message=f'Se revocó tu acceso al proyecto privado "{getattr(project, "name", project_id)}".',
        level="warning",
        tags=["acl", "project", "private", "acl.project.revoked"],
        recipient_user_ids=[user_id],
        scope_type="project",
        scope_id=project_id,
        action_url="/projects",
        actor_user_id=session.user_id,
        metadata={
            "projectId": project_id,
            "projectName": getattr(project, "name", None),
            "targetUserId": user_id,
            "targetUsername": getattr(target_user, "username", None),
            "isActive": False,
        },
    )
    return None

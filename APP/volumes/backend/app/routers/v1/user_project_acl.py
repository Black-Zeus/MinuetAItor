# routers/v1/user_project_acl.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import require_roles
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
from services.user_project_acl_service import (
    change_user_project_acl_status,
    create_user_project_acl,
    delete_user_project_acl,
    get_user_project_acl,
    list_user_project_acls,
    update_user_project_acl,
)
from services.notification_service import enqueue_confidential_project_acl_notifications

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
    await enqueue_confidential_project_acl_notifications(
        db,
        user_id=body.user_id,
        project_id=body.project_id,
        action="granted",
        actor_user_id=session.user_id,
        reason="Asignacion o actualizacion de acceso confidencial.",
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
    await enqueue_confidential_project_acl_notifications(
        db,
        user_id=user_id,
        project_id=project_id,
        action="granted" if result.get("isActive", True) else "revoked",
        actor_user_id=session.user_id,
        reason="Actualizacion de acceso confidencial.",
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
    await enqueue_confidential_project_acl_notifications(
        db,
        user_id=user_id,
        project_id=project_id,
        action="granted" if body.is_active else "revoked",
        actor_user_id=session.user_id,
        reason="Cambio de estado de acceso confidencial.",
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
    await enqueue_confidential_project_acl_notifications(
        db,
        user_id=user_id,
        project_id=project_id,
        action="revoked",
        actor_user_id=session.user_id,
        reason="Acceso confidencial eliminado.",
    )
    return None

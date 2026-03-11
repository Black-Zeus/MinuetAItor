# routers/v1/user_client_acl.py
#
# Propósito: gestiona los PERMISOS GRANULARES de un usuario sobre un cliente.
# Requiere que el usuario ya esté asignado al cliente en user_clients.
#
# Diferencia con user_clients:
#   - user_clients  → ¿este usuario pertenece a este cliente? (is_active)
#   - user_client_acl → ¿qué puede hacer ese usuario dentro del cliente? (read/edit/owner)
#
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import require_roles
from db.session import get_db
from schemas.auth import UserSession
from schemas.user_client_acl import (
    UserClientAclCreateRequest,
    UserClientAclFilterRequest,
    UserClientAclListResponse,
    UserClientAclResponse,
    UserClientAclStatusRequest,
    UserClientAclUpdateRequest,
)
from services.user_client_acl_service import (
    change_user_client_acl_status,
    create_user_client_acl,
    delete_user_client_acl,
    get_user_client_acl,
    list_user_client_acls,
    update_user_client_acl,
)
from services.notification_service import enqueue_confidential_client_acl_notifications

router = APIRouter(prefix="/user-client-acl", tags=["UserClientAcl"])


# CRÍTICO: /list antes que rutas con path params
@router.post("/list", response_model=UserClientAclListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: UserClientAclFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return list_user_client_acls(db, body)


@router.get("/{user_id}/{client_id}", response_model=UserClientAclResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    user_id: str,
    client_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return get_user_client_acl(db, user_id, client_id)


@router.post("", response_model=UserClientAclResponse, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    body: UserClientAclCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    result = create_user_client_acl(db, body, created_by_id=session.user_id)
    await enqueue_confidential_client_acl_notifications(
        db,
        user_id=body.user_id,
        client_id=body.client_id,
        action="granted",
        actor_user_id=session.user_id,
        reason="Asignacion o actualizacion de acceso confidencial.",
    )
    return result


@router.put("/{user_id}/{client_id}", response_model=UserClientAclResponse, status_code=status.HTTP_200_OK)
async def update_endpoint(
    user_id: str,
    client_id: str,
    body: UserClientAclUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    # PUT se mantiene aquí porque el campo 'permission' (read/edit/owner) sí es mutable
    # y es el campo central de esta tabla — distinto a user_clients donde no había nada editable.
    result = update_user_client_acl(db, user_id, client_id, body, updated_by_id=session.user_id)
    await enqueue_confidential_client_acl_notifications(
        db,
        user_id=user_id,
        client_id=client_id,
        action="granted" if result.get("isActive", True) else "revoked",
        actor_user_id=session.user_id,
        reason="Actualizacion de acceso confidencial.",
    )
    return result


@router.patch(
    "/{user_id}/{client_id}/status",
    response_model=UserClientAclResponse,
    status_code=status.HTTP_200_OK,
)
async def status_endpoint(
    user_id: str,
    client_id: str,
    body: UserClientAclStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    result = change_user_client_acl_status(
        db, user_id, client_id,
        is_active=body.is_active,
        updated_by_id=session.user_id,
    )
    await enqueue_confidential_client_acl_notifications(
        db,
        user_id=user_id,
        client_id=client_id,
        action="granted" if body.is_active else "revoked",
        actor_user_id=session.user_id,
        reason="Cambio de estado de acceso confidencial.",
    )
    return result


@router.delete("/{user_id}/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_endpoint(
    user_id: str,
    client_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    delete_user_client_acl(db, user_id, client_id, deleted_by_id=session.user_id)
    await enqueue_confidential_client_acl_notifications(
        db,
        user_id=user_id,
        client_id=client_id,
        action="revoked",
        actor_user_id=session.user_id,
        reason="Acceso confidencial eliminado.",
    )
    return None

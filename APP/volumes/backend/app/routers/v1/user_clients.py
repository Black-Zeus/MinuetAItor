# routers/v1/user_clients.py
#
# Propósito: gestiona la ASIGNACIÓN de un usuario a un cliente (pertenencia básica).
# Es la puerta de entrada — un usuario debe existir aquí antes de poder tener ACL.
#
# Diferencia con user_client_acl:
#   - user_clients  → ¿este usuario pertenece a este cliente? (is_active)
#   - user_client_acl → ¿qué puede hacer ese usuario dentro del cliente? (permission)
#
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from models.clients import Client
from models.user import User
from schemas.auth import UserSession
from schemas.user_clients import (
    UserClientCreateRequest,
    UserClientFilterRequest,
    UserClientListResponse,
    UserClientResponse,
    UserClientStatusRequest,
)
from services.auth_service import get_current_user
from services.notification_center_service import create_in_app_notification
from services.user_clients_service import (
    change_user_client_status,
    create_user_client,
    delete_user_client,
    get_user_client,
    list_user_clients,
)

router = APIRouter(prefix="/user-clients", tags=["UserClients"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


# CRÍTICO: /list antes que rutas con path params
@router.post("/list", response_model=UserClientListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: UserClientFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_user_clients(db, body)


@router.get("/{user_id}/{client_id}", response_model=UserClientResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    user_id: str,
    client_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_user_client(db, user_id, client_id)


@router.post("", response_model=UserClientResponse, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    body: UserClientCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    result = create_user_client(db, body, created_by_id=session.user_id)
    client = db.query(Client).filter(Client.id == body.client_id, Client.deleted_at.is_(None)).first()
    target_user = db.query(User).filter(User.id == body.user_id, User.deleted_at.is_(None)).first()
    await create_in_app_notification(
        db,
        notification_type="access.client.assigned",
        title="Cliente asignado",
        message=f'Se te asignó acceso base al cliente "{getattr(client, "name", body.client_id)}".',
        level="info",
        tags=["access", "client", "assignment", "access.client.assigned"],
        recipient_user_ids=[body.user_id],
        scope_type="client",
        scope_id=body.client_id,
        action_url="/clients",
        actor_user_id=session.user_id,
        metadata={
            "clientId": body.client_id,
            "clientName": getattr(client, "name", None),
            "targetUserId": body.user_id,
            "targetUsername": getattr(target_user, "username", None),
            "isActive": result.get("is_active"),
        },
    )
    return result


@router.patch(
    "/{user_id}/{client_id}/status",
    response_model=UserClientResponse,
    status_code=status.HTTP_200_OK,
)
async def status_endpoint(
    user_id: str,
    client_id: str,
    body: UserClientStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    before = get_user_client(db, user_id, client_id)
    result = change_user_client_status(
        db, user_id, client_id,
        is_active=body.is_active,
        updated_by_id=session.user_id,
    )
    if bool(before.get("is_active")) != bool(result.get("is_active")):
        client = db.query(Client).filter(Client.id == client_id, Client.deleted_at.is_(None)).first()
        target_user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
        is_active = bool(result.get("is_active"))
        await create_in_app_notification(
            db,
            notification_type="access.client.activated" if is_active else "access.client.revoked",
            title="Acceso base a cliente activado" if is_active else "Acceso base a cliente revocado",
            message=(
                f'Se activó tu acceso base al cliente "{getattr(client, "name", client_id)}".'
                if is_active
                else f'Se revocó tu acceso base al cliente "{getattr(client, "name", client_id)}".'
            ),
            level="info" if is_active else "warning",
            tags=["access", "client", "assignment", "access.client.activated" if is_active else "access.client.revoked"],
            recipient_user_ids=[user_id],
            scope_type="client",
            scope_id=client_id,
            action_url="/clients",
            actor_user_id=session.user_id,
            metadata={
                "clientId": client_id,
                "clientName": getattr(client, "name", None),
                "targetUserId": user_id,
                "targetUsername": getattr(target_user, "username", None),
                "previousIsActive": before.get("is_active"),
                "isActive": result.get("is_active"),
            },
        )
    return result


@router.delete("/{user_id}/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_endpoint(
    user_id: str,
    client_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    current = get_user_client(db, user_id, client_id)
    delete_user_client(db, user_id, client_id, deleted_by_id=session.user_id)
    client = db.query(Client).filter(Client.id == client_id, Client.deleted_at.is_(None)).first()
    target_user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    await create_in_app_notification(
        db,
        notification_type="access.client.removed",
        title="Cliente desvinculado",
        message=f'Se eliminó tu asignación base al cliente "{getattr(client, "name", client_id)}".',
        level="warning",
        tags=["access", "client", "assignment", "access.client.removed"],
        recipient_user_ids=[user_id],
        scope_type="client",
        scope_id=client_id,
        action_url="/clients",
        actor_user_id=session.user_id,
        metadata={
            "clientId": client_id,
            "clientName": getattr(client, "name", None),
            "targetUserId": user_id,
            "targetUsername": getattr(target_user, "username", None),
            "wasActive": current.get("is_active"),
        },
    )
    return None

# PUT eliminado — la asignación básica no tiene campos editables más allá
# del estado activo/inactivo, que se cubre con PATCH /{user_id}/{client_id}/status.

# routers/v1/sendmail.py
"""
Endpoints de debug para gestión de email.

⚠️  SOLO DISPONIBLE EN dev / qa.
    Si ENV_NAME=prod → todos los endpoints retornan 403.

Endpoints:
  POST   /v1/sendmail            → encola un email
  GET    /v1/sendmail/queue      → inspecciona la cola (sin consumir)
  DELETE /v1/sendmail/queue      → vacía la cola
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.config import settings
from core.exceptions import ForbiddenException
from db.redis import get_redis
from schemas.auth import UserSession
from schemas.sendmail import (
    QueueClearResponse,
    QueueStatusResponse,
    SendMailRequest,
    SendMailResponse,
)
from services.auth_service import get_current_user
from services.sendmail_service import clear_queue, enqueue_email, get_queue_status

router = APIRouter(prefix="/sendmail", tags=["Sendmail (Dev)"])
bearer = HTTPBearer()


# ── Guard de entorno ──────────────────────────────────────────────────────────

def _guard_dev_only() -> None:
    """Bloquea el acceso si el entorno es producción."""
    if settings.env_name == "prod":
        raise ForbiddenException(
            "Este endpoint no está disponible en producción."
        )


# ── Auth dep ──────────────────────────────────────────────────────────────────

async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=SendMailResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Encolar un email",
    description="Agrega un email a la cola Redis para ser procesado por el worker.",
)
async def send_email_endpoint(
    body: SendMailRequest,
    session: UserSession = Depends(current_user_dep),
):
    _guard_dev_only()
    redis = get_redis()
    return await enqueue_email(body, redis)


@router.get(
    "/queue",
    response_model=QueueStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Ver estado de la cola",
    description="Inspecciona los jobs pendientes en la cola sin consumirlos.",
)
async def queue_status_endpoint(
    session: UserSession = Depends(current_user_dep),
):
    _guard_dev_only()
    redis = get_redis()
    return await get_queue_status(redis)


@router.delete(
    "/queue",
    response_model=QueueClearResponse,
    status_code=status.HTTP_200_OK,
    summary="Vaciar la cola",
    description="Elimina todos los jobs pendientes de la cola de email.",
)
async def clear_queue_endpoint(
    session: UserSession = Depends(current_user_dep),
):
    _guard_dev_only()
    redis = get_redis()
    return await clear_queue(redis)
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import require_roles
from db.session import get_db
from schemas.auth import UserSession
from schemas.system_queues import (
    SystemDlqActionRequest,
    SystemDlqActionResponse,
    SystemDlqListResponse,
    SystemQueuesStatusResponse,
)
from services.system_queue_service import (
    discard_dlq_item,
    get_system_queues_status,
    list_dlq_items,
    requeue_dlq_item,
)

router = APIRouter(prefix="/system/queues", tags=["System Queues"])


@router.get(
    "/status",
    response_model=SystemQueuesStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def get_system_queues_status_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await get_system_queues_status(db)


@router.get(
    "/dlq",
    response_model=SystemDlqListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_dlq_items_endpoint(
    limit: int = 50,
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return await list_dlq_items(limit=limit)


@router.post(
    "/dlq/{item_id}/requeue",
    response_model=SystemDlqActionResponse,
    status_code=status.HTTP_200_OK,
)
async def requeue_dlq_item_endpoint(
    item_id: str,
    body: SystemDlqActionRequest | None = None,
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return await requeue_dlq_item(
        item_id,
        requested_by=session.user_id,
        comment=body.comment if body else None,
    )


@router.post(
    "/dlq/{item_id}/discard",
    response_model=SystemDlqActionResponse,
    status_code=status.HTTP_200_OK,
)
async def discard_dlq_item_endpoint(
    item_id: str,
    body: SystemDlqActionRequest | None = None,
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return await discard_dlq_item(
        item_id,
        requested_by=session.user_id,
        comment=body.comment if body else None,
    )

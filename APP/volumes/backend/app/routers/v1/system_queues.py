from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import require_roles
from db.session import get_db
from schemas.auth import UserSession
from schemas.system_queues import SystemQueuesStatusResponse
from services.system_queue_service import get_system_queues_status

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

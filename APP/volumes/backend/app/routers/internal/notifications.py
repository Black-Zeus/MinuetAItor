from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.internal_auth import verify_internal_secret
from db.session import get_db
from schemas.internal_notifications import TriggerPendingPublicationRemindersResponse
from schemas.notifications import InternalNotificationIngestRequest, InternalNotificationIngestResponse
from services.notification_service import enqueue_pending_publication_reminders
from services.notification_center_service import create_in_app_notification

router = APIRouter(
    prefix="/internal/v1/notifications",
    tags=["Internal — Notifications"],
    dependencies=[Depends(verify_internal_secret)],
)


@router.post(
    "/reminders/pending-publication",
    response_model=TriggerPendingPublicationRemindersResponse,
    status_code=status.HTTP_200_OK,
)
async def pending_publication_reminders_endpoint(
    db: Session = Depends(get_db),
) -> TriggerPendingPublicationRemindersResponse:
    sent = await enqueue_pending_publication_reminders(db)
    return TriggerPendingPublicationRemindersResponse(sent=sent)


@router.post(
    "/ingest",
    response_model=InternalNotificationIngestResponse,
    status_code=status.HTTP_200_OK,
)
async def ingest_notification_endpoint(
    body: InternalNotificationIngestRequest,
    db: Session = Depends(get_db),
) -> InternalNotificationIngestResponse:
    result = await create_in_app_notification(
        db,
        notification_type=body.notification_type,
        title=body.title,
        message=body.message,
        level=body.level,
        tags=body.tags,
        recipient_user_ids=body.recipient_user_ids,
        role_codes=body.role_codes,
        scope_type=body.scope_type,
        scope_id=body.scope_id,
        action_url=body.action_url,
        actor_user_id=body.actor_user_id,
        metadata=body.metadata,
    )
    return result

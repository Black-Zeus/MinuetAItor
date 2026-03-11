from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.internal_auth import verify_internal_secret
from db.session import get_db
from schemas.internal_notifications import TriggerPendingPublicationRemindersResponse
from services.notification_service import enqueue_pending_publication_reminders

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

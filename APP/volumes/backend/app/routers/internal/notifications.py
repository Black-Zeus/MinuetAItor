from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.internal_auth import verify_internal_secret
from db.session import get_db
from schemas.internal_notifications import TriggerPendingPublicationRemindersResponse
from schemas.notifications import InternalNotificationIngestRequest, InternalNotificationIngestResponse
from services.email_branding_service import build_email_branding_bundle
from services.email_queue import queue_templated_email
from services.notification_service import enqueue_pending_publication_reminders
from services.notification_center_service import create_in_app_notification

logger = logging.getLogger(__name__)

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
    if body.email_enabled and body.email_to:
        try:
            branding = build_email_branding_bundle(db, include_organization_logo=True, include_client_logo=False)
            template_context = {
                **branding.context,
                **(body.email_context or {}),
            }
            await queue_templated_email(
                to=body.email_to,
                template_id=body.email_template_id or "system_backup_result",
                template_context=template_context,
                subject=body.email_subject,
                inline_assets=branding.inline_assets,
                notification_context={
                    "notification_type": body.notification_type,
                    "scope_type": body.scope_type,
                    "scope_id": body.scope_id,
                    "tags": body.tags,
                    "metadata": body.metadata,
                    "actor_user_id": body.actor_user_id,
                },
            )
        except Exception as exc:
            logger.warning(
                "No se pudo encolar correo para notificación interna | type=%s recipients=%s err=%s",
                body.notification_type,
                body.email_to,
                exc,
            )
    return result

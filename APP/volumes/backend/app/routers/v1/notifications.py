from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.notifications import (
    NotificationBulkReadStateRequest,
    NotificationBulkReadStateResponse,
    NotificationClearRequest,
    NotificationClearResponse,
    NotificationHideResponse,
    NotificationItemResponse,
    NotificationListResponse,
    NotificationMarkAllReadResponse,
    NotificationMarkReadResponse,
    NotificationPreferencesResponse,
    NotificationPreferencesUpdateRequest,
    NotificationTagsResponse,
    NotificationUnreadCountResponse,
)
from services.auth_service import get_current_user
from services.notification_center_events_service import (
    notification_sse_headers,
    stream_user_notifications,
)
from services.notification_center_service import (
    clear_notifications,
    get_notification_detail,
    list_notification_tags,
    get_unread_notifications_count,
    hide_notification,
    list_notifications,
    mark_all_notifications_as_read,
    mark_notification_as_read,
    update_notifications_read_state,
)
from services.notification_preferences_service import (
    get_user_notification_preferences,
    update_user_notification_preferences,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])
bearer = HTTPBearer()
sse_bearer = HTTPBearer(auto_error=False)


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


async def current_user_or_token_dep(
    credentials: HTTPAuthorizationCredentials = Depends(sse_bearer),
    token: str | None = Query(None, description="JWT para autenticación vía SSE"),
) -> UserSession:
    jwt = (credentials.credentials if credentials else None) or token
    if not jwt:
        raise HTTPException(status_code=401, detail="No se proporcionó token de autenticación.")
    return await get_current_user(jwt)


@router.get(
    "",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
)
def list_notifications_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False, alias="unreadOnly"),
    tag: str | None = Query(None),
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_notifications(
        db,
        session,
        skip=skip,
        limit=limit,
        unread_only=unread_only,
        tag=tag,
    )


@router.get(
    "/tags",
    response_model=NotificationTagsResponse,
    status_code=status.HTTP_200_OK,
)
def notification_tags_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_notification_tags(db, session)


@router.get(
    "/unread-count",
    response_model=NotificationUnreadCountResponse,
    status_code=status.HTTP_200_OK,
)
def unread_count_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return {"count": get_unread_notifications_count(db, session.user_id)}


@router.get(
    "/events",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
async def notifications_events_endpoint(
    session: UserSession = Depends(current_user_or_token_dep),
):
    return StreamingResponse(
        stream_user_notifications(session),
        media_type="text/event-stream",
        headers=notification_sse_headers(),
    )


@router.get(
    "/preferences",
    response_model=NotificationPreferencesResponse,
    status_code=status.HTTP_200_OK,
)
def notification_preferences_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_user_notification_preferences(db, session)


@router.put(
    "/preferences",
    response_model=NotificationPreferencesResponse,
    status_code=status.HTTP_200_OK,
)
def update_notification_preferences_endpoint(
    payload: NotificationPreferencesUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    normalized_items = [
        {"key": item.key, "is_enabled": item.is_enabled}
        for item in payload.items
    ]
    return update_user_notification_preferences(
        db,
        session,
        global_enabled=payload.global_enabled,
        items=normalized_items,
    )


@router.get(
    "/{notification_id}",
    response_model=NotificationItemResponse,
    status_code=status.HTTP_200_OK,
)
def notification_detail_endpoint(
    notification_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_notification_detail(db, session, notification_id)


@router.post(
    "/{notification_id}/read",
    response_model=NotificationMarkReadResponse,
    status_code=status.HTTP_200_OK,
)
async def mark_read_endpoint(
    notification_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return await mark_notification_as_read(db, session, notification_id)


@router.post(
    "/read-state",
    response_model=NotificationBulkReadStateResponse,
    status_code=status.HTTP_200_OK,
)
async def update_notifications_read_state_endpoint(
    payload: NotificationBulkReadStateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return await update_notifications_read_state(
        db,
        session,
        notification_ids=payload.notification_ids,
        is_read=payload.is_read,
    )


@router.post(
    "/clear",
    response_model=NotificationClearResponse,
    status_code=status.HTTP_200_OK,
)
async def clear_notifications_endpoint(
    payload: NotificationClearRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return await clear_notifications(
        db,
        session,
        notification_ids=payload.notification_ids,
    )


@router.post(
    "/read-all",
    response_model=NotificationMarkAllReadResponse,
    status_code=status.HTTP_200_OK,
)
async def mark_all_read_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return await mark_all_notifications_as_read(db, session)


@router.post(
    "/{notification_id}/hide",
    response_model=NotificationHideResponse,
    status_code=status.HTTP_200_OK,
)
async def hide_notification_endpoint(
    notification_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return await hide_notification(db, session, notification_id)

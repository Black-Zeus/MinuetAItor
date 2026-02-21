# routers/v1/user_dashboard_widgets.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.user_dashboard_widgets import (
    UserDashboardWidgetCreateRequest,
    UserDashboardWidgetUpdateRequest,
    UserDashboardWidgetStatusRequest,
    UserDashboardWidgetFilterRequest,
    UserDashboardWidgetResponse,
    UserDashboardWidgetListResponse,
)
from services.auth_service import get_current_user
from services.user_dashboard_widgets_service import (
    get_user_dashboard_widget,
    list_user_dashboard_widgets,
    create_user_dashboard_widget,
    update_user_dashboard_widget,
    change_user_dashboard_widget_status,
    delete_user_dashboard_widget,
)

router = APIRouter(prefix="/user-dashboard-widgets", tags=["UserDashboardWidgets"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get(
    "/{user_id}/{widget_id}",
    response_model=UserDashboardWidgetResponse,
    status_code=status.HTTP_200_OK,
)
def get_endpoint(
    user_id: str,
    widget_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_user_dashboard_widget(db, user_id=user_id, widget_id=widget_id)


@router.post(
    "/list",
    response_model=UserDashboardWidgetListResponse,
    status_code=status.HTTP_200_OK,
)
def list_endpoint(
    body: UserDashboardWidgetFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_user_dashboard_widgets(db, body)


@router.post(
    "",
    response_model=UserDashboardWidgetResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_endpoint(
    body: UserDashboardWidgetCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_user_dashboard_widget(db, body, created_by_id=session.user_id)


@router.put(
    "/{user_id}/{widget_id}",
    response_model=UserDashboardWidgetResponse,
    status_code=status.HTTP_200_OK,
)
def update_endpoint(
    user_id: str,
    widget_id: int,
    body: UserDashboardWidgetUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_user_dashboard_widget(
        db,
        user_id=user_id,
        widget_id=widget_id,
        body=body,
        updated_by_id=session.user_id,
    )


@router.patch(
    "/{user_id}/{widget_id}/status",
    response_model=UserDashboardWidgetResponse,
    status_code=status.HTTP_200_OK,
)
def status_endpoint(
    user_id: str,
    widget_id: int,
    body: UserDashboardWidgetStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_user_dashboard_widget_status(
        db,
        user_id=user_id,
        widget_id=widget_id,
        enabled=body.enabled,
        updated_by_id=session.user_id,
    )


@router.delete(
    "/{user_id}/{widget_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_endpoint(
    user_id: str,
    widget_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_user_dashboard_widget(
        db,
        user_id=user_id,
        widget_id=widget_id,
        deleted_by_id=session.user_id,
    )
    return None
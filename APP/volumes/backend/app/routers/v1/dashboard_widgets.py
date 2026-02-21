# routers/v1/dashboard_widgets.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.dashboard_widgets import (
    DashboardWidgetCreateRequest,
    DashboardWidgetFilterRequest,
    DashboardWidgetListResponse,
    DashboardWidgetStatusRequest,
    DashboardWidgetResponse,
    DashboardWidgetUpdateRequest,
)
from services.auth_service import get_current_user
from services.dashboard_widgets_service import (
    change_dashboard_widget_status,
    create_dashboard_widget,
    delete_dashboard_widget,
    get_dashboard_widget,
    list_dashboard_widgets,
    update_dashboard_widget,
)

router = APIRouter(prefix="/dashboard-widgets", tags=["DashboardWidgets"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=DashboardWidgetResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_dashboard_widget(db, id)


@router.post("/list", response_model=DashboardWidgetListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: DashboardWidgetFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_dashboard_widgets(db, body)


@router.post("", response_model=DashboardWidgetResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: DashboardWidgetCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_dashboard_widget(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=DashboardWidgetResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: DashboardWidgetUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_dashboard_widget(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=DashboardWidgetResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: int,
    body: DashboardWidgetStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_dashboard_widget_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_dashboard_widget(db, id, deleted_by_id=session.user_id)
    return None

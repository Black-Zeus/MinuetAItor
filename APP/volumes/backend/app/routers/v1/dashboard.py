from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import current_user_dep
from db.session import get_db
from schemas.auth import UserSession
from schemas.dashboard import DashboardStatsResponse
from services.dashboard_service import get_dashboard_stats

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse, status_code=status.HTTP_200_OK)
def stats_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_dashboard_stats(db, session)

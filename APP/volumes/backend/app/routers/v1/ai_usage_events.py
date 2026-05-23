from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.ai_usage_events import (
    AIUsageEventFilterRequest,
    AIUsageEventListResponse,
    AIUsageEventResponse,
    AIUsageSummaryRequest,
    AIUsageSummaryResponse,
)
from schemas.auth import UserSession
from services.ai_usage_events_service import get_ai_usage_event, get_ai_usage_summary, list_ai_usage_events
from services.auth_service import get_current_user

router = APIRouter(prefix="/ai-usage-events", tags=["AIUsageEvents"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=AIUsageEventResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_ai_usage_event(db, session, id)


@router.post("/list", response_model=AIUsageEventListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: AIUsageEventFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_ai_usage_events(db, session, body)


@router.post("/summary", response_model=AIUsageSummaryResponse, status_code=status.HTTP_200_OK)
def summary_endpoint(
    body: AIUsageSummaryRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_ai_usage_summary(db, session, body)

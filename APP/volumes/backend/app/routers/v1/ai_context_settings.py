from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import current_user_dep, require_roles
from db.session import get_db
from schemas.ai_context_settings import (
    AiContextAvailabilityResponse,
    AiContextSettingsRequest,
    AiContextSettingsResponse,
)
from schemas.auth import UserSession
from services.ai_context_settings_service import (
    get_ai_context_availability,
    get_ai_context_settings,
    update_ai_context_settings,
)

router = APIRouter(prefix="/context/settings", tags=["Context AI Settings"])


@router.get(
    "/availability",
    response_model=AiContextAvailabilityResponse,
    status_code=status.HTTP_200_OK,
)
def get_availability_endpoint(
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    return get_ai_context_availability(db)


@router.get(
    "",
    response_model=AiContextSettingsResponse,
    status_code=status.HTTP_200_OK,
)
def get_settings_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return get_ai_context_settings(db)


@router.put(
    "",
    response_model=AiContextSettingsResponse,
    status_code=status.HTTP_200_OK,
)
def update_settings_endpoint(
    body: AiContextSettingsRequest,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return update_ai_context_settings(db, body, updated_by_id=session.user_id)

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import require_roles
from db.session import get_db
from schemas.ai_provider_bindings import (
    AIProviderBindingListResponse,
    AIProviderBindingResponse,
    AIProviderBindingUpsertRequest,
)
from schemas.auth import UserSession
from services.ai_provider_bindings_service import (
    list_ai_provider_bindings,
    upsert_ai_provider_binding,
)

router = APIRouter(prefix="/ai-provider-bindings", tags=["AI Provider Bindings"])


@router.get("", response_model=AIProviderBindingListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return list_ai_provider_bindings(db)


@router.put("", response_model=AIProviderBindingResponse, status_code=status.HTTP_200_OK)
def upsert_endpoint(
    body: AIProviderBindingUpsertRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return upsert_ai_provider_binding(db, body, updated_by_id=session.user_id)

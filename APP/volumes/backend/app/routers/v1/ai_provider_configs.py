from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.ai_provider_configs import (
    AIProviderCatalogEntryResponse,
    AIProviderConfigActivateRequest,
    AIProviderConfigCreateRequest,
    AIProviderConfigDiscoverModelsRequest,
    AIProviderConfigDiscoverModelsResponse,
    AIProviderConfigFilterRequest,
    AIProviderConfigListResponse,
    AIProviderConfigResponse,
    AIProviderConfigValidateRequest,
    AIProviderConfigValidationResponse,
    AIProviderConfigUpdateRequest,
)
from schemas.auth import UserSession
from services.ai_provider_configs_service import (
    activate_ai_provider_config,
    create_ai_provider_config,
    deactivate_ai_provider_config,
    delete_ai_provider_config,
    discover_ai_provider_models,
    get_ai_provider_config,
    list_ai_provider_catalog,
    list_ai_provider_configs,
    update_ai_provider_config,
    validate_ai_provider_config,
)
from services.auth_service import get_current_user

router = APIRouter(prefix="/ai-provider-configs", tags=["AI Provider Configs"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.post("/list", response_model=AIProviderConfigListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: AIProviderConfigFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_ai_provider_configs(db, body)


@router.get("/catalog", response_model=list[AIProviderCatalogEntryResponse], status_code=status.HTTP_200_OK)
def catalog_endpoint(
    session: UserSession = Depends(current_user_dep),
):
    return list_ai_provider_catalog()


@router.get("/{id}", response_model=AIProviderConfigResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_ai_provider_config(db, id)


@router.post("", response_model=AIProviderConfigResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: AIProviderConfigCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_ai_provider_config(db, body, created_by_id=session.user_id)


@router.post("/discover-models", response_model=AIProviderConfigDiscoverModelsResponse, status_code=status.HTTP_200_OK)
def discover_models_endpoint(
    body: AIProviderConfigDiscoverModelsRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return discover_ai_provider_models(db, body)


@router.put("/{id}", response_model=AIProviderConfigResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: AIProviderConfigUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_ai_provider_config(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/activate", response_model=AIProviderConfigResponse, status_code=status.HTTP_200_OK)
def activate_endpoint(
    id: str,
    body: AIProviderConfigActivateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    if not body.is_active:
        return deactivate_ai_provider_config(db, id, updated_by_id=session.user_id)
    return activate_ai_provider_config(db, id, updated_by_id=session.user_id)


@router.patch("/{id}/deactivate", response_model=AIProviderConfigResponse, status_code=status.HTTP_200_OK)
def deactivate_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return deactivate_ai_provider_config(db, id, updated_by_id=session.user_id)


@router.post("/validate", response_model=AIProviderConfigValidationResponse, status_code=status.HTTP_200_OK)
def validate_endpoint(
    body: AIProviderConfigValidateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return validate_ai_provider_config(db, body, validated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_200_OK)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return delete_ai_provider_config(db, id, deleted_by_id=session.user_id)

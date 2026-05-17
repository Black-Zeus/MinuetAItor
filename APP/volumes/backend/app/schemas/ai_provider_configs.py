from __future__ import annotations

from pydantic import BaseModel, Field, field_validator
from services.ai_provider_catalog_service import (
    get_ai_commercial_provider_ids,
    get_ai_provider_ids,
)


PROVIDER_TYPES = get_ai_provider_ids()

AUTH_TYPES = {
    "none",
    "api_key",
    "basic",
    "custom_headers",
}

VALIDATION_STATUSES = {
    "unvalidated",
    "valid",
    "error",
    "auth_error",
    "connection_error",
    "timeout",
    "endpoint_unavailable",
}

COMMERCIAL_PROVIDER_TYPES = get_ai_commercial_provider_ids()


def _strip_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class AIProviderCatalogEntryResponse(BaseModel):
    id: str
    label: str
    base_url: str = Field("", serialization_alias="baseUrl")
    validation_endpoint: str = Field("", serialization_alias="validationEndpoint")
    models_endpoint: str = Field("", serialization_alias="modelsEndpoint")
    auth_type: str = Field("none", serialization_alias="authType")
    provider_family: str = Field(..., serialization_alias="providerFamily")
    models_response_format: str = Field(..., serialization_alias="modelsResponseFormat")
    is_commercial: bool = Field(False, serialization_alias="isCommercial")

    model_config = {"populate_by_name": True}


class AIProviderConfigFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)
    is_active: bool | None = Field(None, serialization_alias="isActive")
    provider_type: str | None = Field(None, serialization_alias="providerType")
    validation_status: str | None = Field(None, serialization_alias="validationStatus")
    search: str | None = None

    @field_validator("provider_type")
    @classmethod
    def normalize_provider_filter(cls, value: str | None) -> str | None:
        cleaned = _strip_or_none(value)
        if cleaned is None:
            return None
        if cleaned not in get_ai_provider_ids():
            raise ValueError("Tipo de proveedor inválido")
        return cleaned

    @field_validator("validation_status")
    @classmethod
    def normalize_validation_filter(cls, value: str | None) -> str | None:
        cleaned = _strip_or_none(value)
        if cleaned is None:
            return None
        if cleaned not in VALIDATION_STATUSES:
            raise ValueError("Estado de validación inválido")
        return cleaned

    @field_validator("search")
    @classmethod
    def normalize_search(cls, value: str | None) -> str | None:
        return _strip_or_none(value)

    model_config = {"populate_by_name": True}


class AIProviderConfigCreateRequest(BaseModel):
    name: str
    provider_type: str = Field(..., serialization_alias="providerType")
    base_url: str = Field(..., serialization_alias="baseUrl")
    validation_endpoint: str | None = Field(None, serialization_alias="validationEndpoint")
    models_endpoint: str | None = Field(None, serialization_alias="modelsEndpoint")
    model_name: str | None = Field(None, serialization_alias="modelName")
    auth_type: str = Field("none", serialization_alias="authType")
    token: str | None = None
    username: str | None = None
    password: str | None = None
    custom_headers: dict[str, str] | None = Field(None, serialization_alias="customHeaders")
    allow_model_discovery: bool = Field(True, serialization_alias="allowModelDiscovery")
    is_active: bool = Field(False, serialization_alias="isActive")
    timeout_seconds: int = Field(15, ge=1, le=120, serialization_alias="timeoutSeconds")
    validation_token: str = Field(..., serialization_alias="validationToken")

    @field_validator("name", "base_url")
    @classmethod
    def require_text(cls, value: str) -> str:
        cleaned = str(value or "").strip()
        if not cleaned:
            raise ValueError("Este campo es obligatorio")
        return cleaned

    @field_validator("provider_type")
    @classmethod
    def validate_provider_type(cls, value: str) -> str:
        cleaned = str(value or "").strip()
        if cleaned not in get_ai_provider_ids():
            raise ValueError("Tipo de proveedor inválido")
        return cleaned

    @field_validator("auth_type")
    @classmethod
    def validate_auth_type(cls, value: str) -> str:
        cleaned = str(value or "").strip()
        if cleaned not in AUTH_TYPES:
            raise ValueError("Tipo de autenticación inválido")
        return cleaned

    @field_validator(
        "validation_endpoint",
        "models_endpoint",
        "model_name",
        "token",
        "username",
        "password",
    )
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return _strip_or_none(value)

    @field_validator("custom_headers")
    @classmethod
    def normalize_custom_headers(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is None:
            return None
        normalized: dict[str, str] = {}
        for raw_key, raw_header_value in value.items():
            key = str(raw_key or "").strip()
            header_value = str(raw_header_value or "").strip()
            if not key:
                raise ValueError("Los headers personalizados requieren una clave válida")
            if not header_value:
                raise ValueError(f"El header '{key}' no puede quedar vacío")
            normalized[key] = header_value
        return normalized or None

    @field_validator("validation_token")
    @classmethod
    def require_validation_token(cls, value: str) -> str:
        cleaned = str(value or "").strip()
        if not cleaned:
            raise ValueError("Debes validar la configuración antes de guardar")
        return cleaned

    model_config = {"populate_by_name": True}


class AIProviderConfigUpdateRequest(BaseModel):
    name: str | None = None
    provider_type: str | None = Field(None, serialization_alias="providerType")
    base_url: str | None = Field(None, serialization_alias="baseUrl")
    validation_endpoint: str | None = Field(None, serialization_alias="validationEndpoint")
    models_endpoint: str | None = Field(None, serialization_alias="modelsEndpoint")
    model_name: str | None = Field(None, serialization_alias="modelName")
    auth_type: str | None = Field(None, serialization_alias="authType")
    token: str | None = None
    username: str | None = None
    password: str | None = None
    custom_headers: dict[str, str] | None = Field(None, serialization_alias="customHeaders")
    allow_model_discovery: bool | None = Field(None, serialization_alias="allowModelDiscovery")
    is_active: bool | None = Field(None, serialization_alias="isActive")
    timeout_seconds: int | None = Field(None, ge=1, le=120, serialization_alias="timeoutSeconds")
    validation_token: str = Field(..., serialization_alias="validationToken")

    @field_validator("name", "base_url")
    @classmethod
    def normalize_required_when_present(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        if not cleaned:
            raise ValueError("Este campo no puede quedar vacío")
        return cleaned

    @field_validator("provider_type")
    @classmethod
    def validate_optional_provider_type(cls, value: str | None) -> str | None:
        cleaned = _strip_or_none(value)
        if cleaned is None:
            return None
        if cleaned not in get_ai_provider_ids():
            raise ValueError("Tipo de proveedor inválido")
        return cleaned

    @field_validator("auth_type")
    @classmethod
    def validate_optional_auth_type(cls, value: str | None) -> str | None:
        cleaned = _strip_or_none(value)
        if cleaned is None:
            return None
        if cleaned not in AUTH_TYPES:
            raise ValueError("Tipo de autenticación inválido")
        return cleaned

    @field_validator(
        "validation_endpoint",
        "models_endpoint",
        "model_name",
        "token",
        "username",
        "password",
    )
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return _strip_or_none(value)

    @field_validator("custom_headers")
    @classmethod
    def normalize_custom_headers(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is None:
            return None
        normalized: dict[str, str] = {}
        for raw_key, raw_header_value in value.items():
            key = str(raw_key or "").strip()
            header_value = str(raw_header_value or "").strip()
            if not key:
                raise ValueError("Los headers personalizados requieren una clave válida")
            if not header_value:
                raise ValueError(f"El header '{key}' no puede quedar vacío")
            normalized[key] = header_value
        return normalized or None

    @field_validator("validation_token")
    @classmethod
    def require_update_validation_token(cls, value: str) -> str:
        cleaned = str(value or "").strip()
        if not cleaned:
            raise ValueError("Debes validar la configuración antes de guardar")
        return cleaned

    model_config = {"populate_by_name": True}


class AIProviderConfigActivateRequest(BaseModel):
    is_active: bool = Field(True, serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class AIProviderConfigValidateRequest(BaseModel):
    config_id: str | None = Field(None, serialization_alias="configId")
    name: str | None = None
    provider_type: str | None = Field(None, serialization_alias="providerType")
    base_url: str | None = Field(None, serialization_alias="baseUrl")
    validation_endpoint: str | None = Field(None, serialization_alias="validationEndpoint")
    models_endpoint: str | None = Field(None, serialization_alias="modelsEndpoint")
    model_name: str | None = Field(None, serialization_alias="modelName")
    auth_type: str | None = Field(None, serialization_alias="authType")
    token: str | None = None
    username: str | None = None
    password: str | None = None
    custom_headers: dict[str, str] | None = Field(None, serialization_alias="customHeaders")
    allow_model_discovery: bool | None = Field(True, serialization_alias="allowModelDiscovery")
    is_active: bool | None = Field(False, serialization_alias="isActive")
    timeout_seconds: int | None = Field(None, ge=1, le=120, serialization_alias="timeoutSeconds")

    @field_validator(
        "config_id",
        "name",
        "provider_type",
        "base_url",
        "validation_endpoint",
        "models_endpoint",
        "model_name",
        "auth_type",
        "token",
        "username",
        "password",
    )
    @classmethod
    def normalize_validation_strings(cls, value: str | None) -> str | None:
        return _strip_or_none(value)

    @field_validator("custom_headers")
    @classmethod
    def normalize_validation_headers(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is None:
            return None
        normalized: dict[str, str] = {}
        for raw_key, raw_header_value in value.items():
            key = str(raw_key or "").strip()
            header_value = str(raw_header_value or "").strip()
            if not key:
                raise ValueError("Los headers personalizados requieren una clave válida")
            if not header_value:
                raise ValueError(f"El header '{key}' no puede quedar vacío")
            normalized[key] = header_value
        return normalized or None

    model_config = {"populate_by_name": True}


class AIProviderConfigDiscoverModelsRequest(BaseModel):
    config_id: str | None = Field(None, serialization_alias="configId")
    name: str | None = None
    provider_type: str | None = Field(None, serialization_alias="providerType")
    base_url: str | None = Field(None, serialization_alias="baseUrl")
    validation_endpoint: str | None = Field(None, serialization_alias="validationEndpoint")
    models_endpoint: str | None = Field(None, serialization_alias="modelsEndpoint")
    model_name: str | None = Field(None, serialization_alias="modelName")
    auth_type: str | None = Field(None, serialization_alias="authType")
    token: str | None = None
    username: str | None = None
    password: str | None = None
    custom_headers: dict[str, str] | None = Field(None, serialization_alias="customHeaders")
    allow_model_discovery: bool | None = Field(True, serialization_alias="allowModelDiscovery")
    is_active: bool | None = Field(None, serialization_alias="isActive")
    timeout_seconds: int | None = Field(None, ge=1, le=120, serialization_alias="timeoutSeconds")

    @field_validator(
        "config_id",
        "name",
        "provider_type",
        "base_url",
        "validation_endpoint",
        "models_endpoint",
        "model_name",
        "auth_type",
        "token",
        "username",
        "password",
    )
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return _strip_or_none(value)

    @field_validator("custom_headers")
    @classmethod
    def normalize_custom_headers(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is None:
            return None
        normalized: dict[str, str] = {}
        for raw_key, raw_header_value in value.items():
            key = str(raw_key or "").strip()
            header_value = str(raw_header_value or "").strip()
            if not key:
                raise ValueError("Los headers personalizados requieren una clave válida")
            if not header_value:
                raise ValueError(f"El header '{key}' no puede quedar vacío")
            normalized[key] = header_value
        return normalized or None

    model_config = {"populate_by_name": True}


class AIProviderConfigResponse(BaseModel):
    id: str
    name: str
    provider_type: str = Field(..., serialization_alias="providerType")
    base_url: str = Field(..., serialization_alias="baseUrl")
    validation_endpoint: str | None = Field(None, serialization_alias="validationEndpoint")
    models_endpoint: str | None = Field(None, serialization_alias="modelsEndpoint")
    model_name: str | None = Field(None, serialization_alias="modelName")
    auth_type: str = Field(..., serialization_alias="authType")
    has_token: bool = Field(..., serialization_alias="hasToken")
    token_hint: str | None = Field(None, serialization_alias="tokenHint")
    username: str | None = None
    has_password: bool = Field(..., serialization_alias="hasPassword")
    custom_headers: dict[str, str] | None = Field(None, serialization_alias="customHeaders")
    allow_model_discovery: bool = Field(..., serialization_alias="allowModelDiscovery")
    is_active: bool = Field(..., serialization_alias="isActive")
    validation_status: str = Field(..., serialization_alias="validationStatus")
    last_validated_at: str | None = Field(None, serialization_alias="lastValidatedAt")
    last_error: str | None = Field(None, serialization_alias="lastError")
    timeout_seconds: int = Field(..., serialization_alias="timeoutSeconds")
    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    last_validated_by: UserRefResponse | None = Field(None, serialization_alias="lastValidatedBy")

    model_config = {"populate_by_name": True}


class AIProviderConfigListResponse(BaseModel):
    items: list[AIProviderConfigResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}


class AIProviderConfigValidationResponse(BaseModel):
    ok: bool
    status: str
    message: str
    last_validated_at: str | None = Field(None, serialization_alias="lastValidatedAt")
    validation_token: str | None = Field(None, serialization_alias="validationToken")
    expires_at: str | None = Field(None, serialization_alias="expiresAt")
    config: AIProviderConfigResponse | None = None

    model_config = {"populate_by_name": True}


class AIProviderModelOptionResponse(BaseModel):
    value: str
    label: str


class AIProviderConfigDiscoverModelsResponse(BaseModel):
    items: list[AIProviderModelOptionResponse]
    endpoint_used: str | None = Field(None, serialization_alias="endpointUsed")

    model_config = {"populate_by_name": True}

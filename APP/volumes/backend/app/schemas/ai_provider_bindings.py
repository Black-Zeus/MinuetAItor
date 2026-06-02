from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from schemas.ai_provider_configs import UserRefResponse

AI_PROVIDER_BINDING_PURPOSES = {
    "minute_analysis",
    "context_embeddings",
    "context_answering",
}


def _strip(value: str | None) -> str:
    return str(value or "").strip()


class AIProviderBindingUpsertRequest(BaseModel):
    purpose: str
    provider_config_id: str = Field(..., alias="providerConfigId", serialization_alias="providerConfigId")
    model_name: str = Field(..., alias="modelName", serialization_alias="modelName")
    embedding_dimensions: int | None = Field(None, ge=1, le=100000, alias="embeddingDimensions", serialization_alias="embeddingDimensions")

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, value: str) -> str:
        cleaned = _strip(value)
        if cleaned not in AI_PROVIDER_BINDING_PURPOSES:
            raise ValueError("Propósito de uso IA inválido.")
        return cleaned

    @field_validator("provider_config_id", "model_name")
    @classmethod
    def require_text(cls, value: str) -> str:
        cleaned = _strip(value)
        if not cleaned:
            raise ValueError("Este campo es obligatorio.")
        return cleaned

    model_config = {"populate_by_name": True}


class AIProviderBindingProviderResponse(BaseModel):
    id: str
    name: str
    provider_type: str = Field(..., serialization_alias="providerType")
    validation_status: str = Field(..., serialization_alias="validationStatus")
    is_active: bool = Field(..., serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class AIProviderBindingResponse(BaseModel):
    id: str
    purpose: str
    provider_config_id: str = Field(..., serialization_alias="providerConfigId")
    model_name: str = Field(..., serialization_alias="modelName")
    embedding_dimensions: int | None = Field(None, serialization_alias="embeddingDimensions")
    is_active: bool = Field(..., serialization_alias="isActive")
    provider: AIProviderBindingProviderResponse | None = None
    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")

    model_config = {"populate_by_name": True}


class AIProviderBindingListResponse(BaseModel):
    items: list[AIProviderBindingResponse]

    model_config = {"populate_by_name": True}

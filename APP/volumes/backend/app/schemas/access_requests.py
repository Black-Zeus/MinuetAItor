from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator


class AccessRequestStatusResponse(BaseModel):
    enabled: bool


class AccessRequestCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200, alias="fullName")
    email: EmailStr
    observation: str | None = Field(None, max_length=1000)

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value: str) -> str:
        normalized = " ".join(str(value or "").strip().split())
        if not normalized:
            raise ValueError("El nombre es requerido.")
        return normalized

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        return str(value or "").strip().lower()

    @field_validator("observation")
    @classmethod
    def clean_observation(cls, value: str | None) -> str | None:
        normalized = str(value or "").strip()
        return normalized or None

    model_config = {"populate_by_name": True}


class AccessRequestCreateResponse(BaseModel):
    id: str
    status: str
    message: str


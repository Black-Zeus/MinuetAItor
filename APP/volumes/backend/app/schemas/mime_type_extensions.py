# schemas/mime_type_extensions.py

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class MimeTypeExtensionCreateRequest(BaseModel):
    mime_type_id: int = Field(..., ge=0, serialization_alias="mimeTypeId")
    file_extension_id: int = Field(..., ge=0, serialization_alias="fileExtensionId")
    is_default: bool = Field(False, serialization_alias="isDefault")
    is_active: bool = Field(True, serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class MimeTypeExtensionUpdateRequest(BaseModel):
    is_default: bool | None = Field(None, serialization_alias="isDefault")
    is_active: bool | None = Field(None, serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class MimeTypeExtensionStatusRequest(BaseModel):
    is_active: bool = Field(..., serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class MimeTypeExtensionFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    mime_type_id: int | None = Field(None, ge=0, serialization_alias="mimeTypeId")
    file_extension_id: int | None = Field(None, ge=0, serialization_alias="fileExtensionId")
    is_default: bool | None = Field(None, serialization_alias="isDefault")
    is_active: bool | None = None  # regla estándar

    model_config = {"populate_by_name": True}


class MimeTypeExtensionResponse(BaseModel):
    mime_type_id: int = Field(..., serialization_alias="mimeTypeId")
    file_extension_id: int = Field(..., serialization_alias="fileExtensionId")

    is_default: bool = Field(..., serialization_alias="isDefault")
    is_active: bool = Field(..., serialization_alias="isActive")

    created_at: datetime | None = Field(None, serialization_alias="createdAt")
    updated_at: datetime | None = Field(None, serialization_alias="updatedAt")
    deleted_at: datetime | None = Field(None, serialization_alias="deletedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class MimeTypeExtensionListResponse(BaseModel):
    items: list[MimeTypeExtensionResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
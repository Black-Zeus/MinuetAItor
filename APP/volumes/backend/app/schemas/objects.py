# schemas/objects.py
from __future__ import annotations

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class ObjectCreateRequest(BaseModel):
    bucket_id: int = Field(..., ge=1)
    object_key: str = Field(..., min_length=1, max_length=500)

    content_type: str = Field(..., min_length=1, max_length=120)
    file_ext: str = Field(..., min_length=1, max_length=20)

    size_bytes: int | None = Field(None, ge=0)
    etag: str | None = Field(None, max_length=128)
    sha256: str | None = Field(None, min_length=64, max_length=64)

    model_config = {"populate_by_name": True}


class ObjectUpdateRequest(BaseModel):
    bucket_id: int | None = Field(None, ge=1)
    object_key: str | None = Field(None, min_length=1, max_length=500)

    content_type: str | None = Field(None, min_length=1, max_length=120)
    file_ext: str | None = Field(None, min_length=1, max_length=20)

    size_bytes: int | None = Field(None, ge=0)
    etag: str | None = Field(None, max_length=128)
    sha256: str | None = Field(None, min_length=64, max_length=64)

    model_config = {"populate_by_name": True}


class ObjectFilterRequest(BaseModel):
    bucket_id: int | None = Field(None, ge=1)
    content_type: str | None = None
    sha256: str | None = Field(None, min_length=64, max_length=64)
    object_key: str | None = None

    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    model_config = {"populate_by_name": True}


class ObjectResponse(BaseModel):
    id: str

    bucket_id: int = Field(..., serialization_alias="bucketId")
    object_key: str = Field(..., serialization_alias="objectKey")

    content_type: str = Field(..., serialization_alias="contentType")
    file_ext: str = Field(..., serialization_alias="fileExt")

    size_bytes: int | None = Field(None, serialization_alias="sizeBytes")
    etag: str | None = None
    sha256: str | None = None

    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")

    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    deleted_at: str | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class ObjectListResponse(BaseModel):
    items: list[ObjectResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
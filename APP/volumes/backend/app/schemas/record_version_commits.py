# schemas/record_version_commits.py

from datetime import datetime
from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class RecordVersionCommitCreateRequest(BaseModel):
    record_version_id: str = Field(..., min_length=36, max_length=36)
    parent_version_id: str | None = Field(None, min_length=36, max_length=36)
    commit_title: str = Field(..., min_length=1, max_length=160)
    commit_body: str | None = None

    model_config = {"populate_by_name": True}


class RecordVersionCommitUpdateRequest(BaseModel):
    parent_version_id: str | None = Field(None, min_length=36, max_length=36)
    commit_title: str | None = Field(None, min_length=1, max_length=160)
    commit_body: str | None = None

    model_config = {"populate_by_name": True}


class RecordVersionCommitFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    record_version_id: str | None = Field(None, min_length=36, max_length=36)
    parent_version_id: str | None = Field(None, min_length=36, max_length=36)
    actor_user_id: str | None = Field(None, min_length=36, max_length=36)

    model_config = {"populate_by_name": True}


class RecordVersionCommitResponse(BaseModel):
    id: int

    record_version_id: str = Field(..., serialization_alias="recordVersionId")
    parent_version_id: str | None = Field(None, serialization_alias="parentVersionId")

    commit_title: str = Field(..., serialization_alias="commitTitle")
    commit_body: str | None = Field(None, serialization_alias="commitBody")

    actor_user: UserRefResponse | None = Field(None, serialization_alias="actorUser")

    created_at: str | None = Field(None, serialization_alias="createdAt")
    deleted_at: str | None = Field(None, serialization_alias="deletedAt")
    deleted_by: UserRefResponse | None = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class RecordVersionCommitListResponse(BaseModel):
    items: list[RecordVersionCommitResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}
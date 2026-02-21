# routers/v1/record_type_artifact_types.py

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.record_type_artifact_types import (
    RecordTypeArtifactTypesCreateRequest,
    RecordTypeArtifactTypesFilterRequest,
    RecordTypeArtifactTypesListResponse,
    RecordTypeArtifactTypesResponse,
    RecordTypeArtifactTypesStatusRequest,
    RecordTypeArtifactTypesUpdateRequest,
)
from services.auth_service import get_current_user
from services.record_type_artifact_types_service import (
    change_record_type_artifact_type_status,
    create_record_type_artifact_type,
    delete_record_type_artifact_type,
    get_record_type_artifact_type,
    list_record_type_artifact_types,
    update_record_type_artifact_type,
)

router = APIRouter(prefix="/record-type-artifact-types", tags=["RecordTypeArtifactTypes"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.post("/list", response_model=RecordTypeArtifactTypesListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: RecordTypeArtifactTypesFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_record_type_artifact_types(db, body)


@router.post("", response_model=RecordTypeArtifactTypesResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: RecordTypeArtifactTypesCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_record_type_artifact_type(db, body, created_by_id=session.user_id)


@router.get(
    "/{record_type_id}/{artifact_type_id}",
    response_model=RecordTypeArtifactTypesResponse,
    status_code=status.HTTP_200_OK,
)
def get_endpoint(
    record_type_id: int,
    artifact_type_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_record_type_artifact_type(db, record_type_id, artifact_type_id)


@router.put(
    "/{record_type_id}/{artifact_type_id}",
    response_model=RecordTypeArtifactTypesResponse,
    status_code=status.HTTP_200_OK,
)
def update_endpoint(
    record_type_id: int,
    artifact_type_id: int,
    body: RecordTypeArtifactTypesUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_record_type_artifact_type(
        db,
        record_type_id,
        artifact_type_id,
        body,
        updated_by_id=session.user_id,
    )


@router.patch("/status", response_model=RecordTypeArtifactTypesResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    body: RecordTypeArtifactTypesStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_record_type_artifact_type_status(
        db,
        body.record_type_id,
        body.artifact_type_id,
        is_active=body.is_active,
        updated_by_id=session.user_id,
    )


@router.delete(
    "/{record_type_id}/{artifact_type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_endpoint(
    record_type_id: int,
    artifact_type_id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_record_type_artifact_type(db, record_type_id, artifact_type_id, deleted_by_id=session.user_id)
    return None
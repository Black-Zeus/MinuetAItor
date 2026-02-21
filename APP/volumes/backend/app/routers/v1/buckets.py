# routers/v1/buckets.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.buckets import (
    BucketCreateRequest,
    BucketFilterRequest,
    BucketListResponse,
    BucketResponse,
    BucketStatusRequest,
    BucketUpdateRequest,
)
from services.auth_service import get_current_user
from services.buckets_service import (
    change_bucket_status,
    create_bucket,
    delete_bucket,
    get_bucket,
    list_buckets,
    update_bucket,
)

router = APIRouter(prefix="/buckets", tags=["Buckets"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=BucketResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    _ = session
    return get_bucket(db, id)


@router.post("/list", response_model=BucketListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: BucketFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    _ = session
    return list_buckets(db, body)


@router.post("", response_model=BucketResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: BucketCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_bucket(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=BucketResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: int,
    body: BucketUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_bucket(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/status", response_model=BucketResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: int,
    body: BucketStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_bucket_status(db, id, is_active=body.is_active, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_bucket(db, id, deleted_by_id=session.user_id)
    return None
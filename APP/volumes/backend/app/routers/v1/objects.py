# routers/v1/objects.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.objects import (
    ObjectCreateRequest,
    ObjectFilterRequest,
    ObjectListResponse,
    ObjectResponse,
)
from services.auth_service import get_current_user
from services.objects_service import (
    create_object,
    delete_object,
    get_object,
    list_objects,
)

router = APIRouter(prefix="/objects", tags=["Objects"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


# CRÍTICO: /list antes que GET /{id}
@router.post("/list", response_model=ObjectListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: ObjectFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_objects(db, body)


@router.get("/{id}", response_model=ObjectResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_object(db, id)


@router.post("", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: ObjectCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_object(db, body, created_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_object(db, id, deleted_by_id=session.user_id)
    return None

# PUT eliminado — un objeto de storage es inmutable una vez creado.
# Si el archivo cambia, se crea un nuevo objeto con su propio registro.
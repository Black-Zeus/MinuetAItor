# routers/v1/clients.py
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.orm import Session

from core.authz import current_user_dep
from db.session import get_db
from schemas.auth import UserSession
from services.upload_validation import safe_content_disposition
from schemas.clients import (
    ClientCreateRequest,
    ClientFilterRequest,
    ClientListResponse,
    ClientResponse,
    ClientStatusRequest,
    ClientUpdateRequest,
)
from services.clients_service import (
    change_client_status,
    create_client,
    delete_client_logo,
    delete_client,
    get_client,
    list_clients,
    read_client_logo_content,
    upload_client_logo,
    update_client,
)

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.get("/industries", response_model=list[str], status_code=status.HTTP_200_OK)
def industries_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    """
    Devuelve todas las industrias distintas presentes en clientes,
    normalizadas a title case español.
    """
    from services.clients_service import list_industries
    return list_industries(db)

@router.get("/{id}/logo", status_code=status.HTTP_200_OK)
def logo_endpoint(
    id: str,
    db: Session = Depends(get_db),
):
    content, content_type = read_client_logo_content(db, id)
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": safe_content_disposition("client-logo", disposition="inline"),
            "X-Content-Type-Options": "nosniff",
        },
    )

@router.get("/{id}", response_model=ClientResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_client(db, id, session)


@router.post("/list", response_model=ClientListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: ClientFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_clients(db, body, session)


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: ClientCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_client(db, body, created_by_id=session.user_id, session=session)


@router.post("/{id}/logo", status_code=status.HTTP_200_OK)
async def upload_logo_endpoint(
    id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return await upload_client_logo(db, id, file, session)


@router.put("/{id}", response_model=ClientResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: ClientUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return update_client(db, id, body, updated_by_id=session.user_id, session=session)


@router.patch("/{id}/status", response_model=ClientResponse, status_code=status.HTTP_200_OK)
def status_endpoint(
    id: str,
    body: ClientStatusRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return change_client_status(
        db,
        id,
        is_active=body.is_active,
        updated_by_id=session.user_id,
        session=session,
    )


@router.delete("/{id}/logo", status_code=status.HTTP_200_OK)
def delete_logo_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return delete_client_logo(db, id, session)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    delete_client(db, id, deleted_by_id=session.user_id, session=session)
    return None

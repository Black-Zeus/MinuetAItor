from __future__ import annotations

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.orm import Session

from core.authz import require_roles
from db.session import get_db
from schemas.auth import UserSession
from schemas.organization_settings import OrganizationSettingsRequest, OrganizationSettingsResponse
from services.upload_validation import safe_content_disposition
from services.organization_settings_service import (
    delete_organization_banner,
    delete_organization_logo,
    get_organization_settings,
    read_organization_banner_content,
    read_organization_logo_content,
    update_organization_settings,
    upload_organization_banner,
    upload_organization_logo,
)

router = APIRouter(prefix="/system/organization", tags=["System Organization"])


@router.get("/logo", status_code=status.HTTP_200_OK)
def organization_logo_endpoint(
    db: Session = Depends(get_db),
):
    content, content_type = read_organization_logo_content(db)
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": safe_content_disposition("organization-logo", disposition="inline"),
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/logo", status_code=status.HTTP_200_OK)
async def upload_organization_logo_endpoint(
    file: UploadFile = File(...),
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await upload_organization_logo(db, file, actor_user_id=session.user_id)


@router.delete("/logo", status_code=status.HTTP_200_OK)
def delete_organization_logo_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return delete_organization_logo(db, actor_user_id=session.user_id)


@router.get("/banner", status_code=status.HTTP_200_OK)
def organization_banner_endpoint(
    db: Session = Depends(get_db),
):
    content, content_type = read_organization_banner_content(db)
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": safe_content_disposition("organization-banner", disposition="inline"),
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/banner", status_code=status.HTTP_200_OK)
async def upload_organization_banner_endpoint(
    file: UploadFile = File(...),
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await upload_organization_banner(db, file, actor_user_id=session.user_id)


@router.delete("/banner", status_code=status.HTTP_200_OK)
def delete_organization_banner_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return delete_organization_banner(db, actor_user_id=session.user_id)


@router.get(
    "",
    response_model=OrganizationSettingsResponse,
    status_code=status.HTTP_200_OK,
)
def get_organization_settings_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return get_organization_settings(db)


@router.put(
    "",
    response_model=OrganizationSettingsResponse,
    status_code=status.HTTP_200_OK,
)
def update_organization_settings_endpoint(
    body: OrganizationSettingsRequest,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return update_organization_settings(db, body, updated_by_id=session.user_id)

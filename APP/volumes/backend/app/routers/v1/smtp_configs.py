from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import require_roles
from db.session import get_db
from schemas.auth import UserSession
from schemas.smtp_configs import (
    SmtpConfigActivateRequest,
    SmtpConfigCreateRequest,
    SmtpConfigFilterRequest,
    SmtpConfigListResponse,
    SmtpConfigResponse,
    SmtpConfigTestRequest,
    SmtpConfigTestResponse,
    SmtpConfigUpdateRequest,
)
from services.smtp_configs_service import (
    activate_smtp_config,
    create_smtp_config,
    delete_smtp_config,
    get_smtp_config,
    list_smtp_configs,
    test_smtp_config,
    update_smtp_config,
)

router = APIRouter(prefix="/smtp-configs", tags=["SMTP Configs"])


@router.post("/list", response_model=SmtpConfigListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: SmtpConfigFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return list_smtp_configs(db, body)


@router.get("/{id}", response_model=SmtpConfigResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return get_smtp_config(db, id)


@router.post("/test", response_model=SmtpConfigTestResponse, status_code=status.HTTP_200_OK)
def test_endpoint(
    body: SmtpConfigTestRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return test_smtp_config(db, body, tested_by_id=session.user_id)


@router.post("", response_model=SmtpConfigResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: SmtpConfigCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return create_smtp_config(db, body, created_by_id=session.user_id)


@router.put("/{id}", response_model=SmtpConfigResponse, status_code=status.HTTP_200_OK)
def update_endpoint(
    id: str,
    body: SmtpConfigUpdateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return update_smtp_config(db, id, body, updated_by_id=session.user_id)


@router.patch("/{id}/activate", response_model=SmtpConfigResponse, status_code=status.HTTP_200_OK)
def activate_endpoint(
    id: str,
    body: SmtpConfigActivateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    if not body.is_active:
        return get_smtp_config(db, id)
    return activate_smtp_config(db, id, updated_by_id=session.user_id)


@router.delete("/{id}", status_code=status.HTTP_200_OK)
def delete_endpoint(
    id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
):
    return delete_smtp_config(db, id, deleted_by_id=session.user_id)

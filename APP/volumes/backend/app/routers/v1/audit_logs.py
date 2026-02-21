# routers/v1/audit_logs.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.audit_logs import (
    AuditLogCreateRequest,
    AuditLogFilterRequest,
    AuditLogListResponse,
    AuditLogResponse,
    # AuditLogUpdateRequest eliminado — audit_log es inmutable (no expone PUT)
)
from services.auth_service import get_current_user
from services.audit_logs_service import (
    create_audit_log,
    get_audit_log,
    list_audit_logs,
)

router = APIRouter(prefix="/audit-logs", tags=["AuditLogs"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.get("/{id}", response_model=AuditLogResponse, status_code=status.HTTP_200_OK)
def get_endpoint(
    id: int,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return get_audit_log(db, id)


@router.post("/list", response_model=AuditLogListResponse, status_code=status.HTTP_200_OK)
def list_endpoint(
    body: AuditLogFilterRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_audit_logs(db, body)


@router.post("", response_model=AuditLogResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    body: AuditLogCreateRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return create_audit_log(db, body, created_by_id=session.user_id)


# PUT eliminado — el audit_log es un registro de auditoría inmutable.
# DELETE eliminado — los registros de auditoría no se borran.
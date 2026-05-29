from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.authz import has_role, require_roles
from core.exceptions import ForbiddenException
from db.session import get_db
from schemas.auth import UserSession
from schemas.system_maintenance import (
    MaintenanceRunNowResponse,
    SystemOperationModeRequest,
    SystemOperationStateResponse,
    SystemMaintenanceConfigRequest,
    SystemMaintenanceConfigResponse,
    SystemMaintenanceStatusResponse,
)
from services.auth_service import get_current_user
from services.system_maintenance_events_service import maintenance_sse_headers, stream_system_maintenance_events
from services.system_maintenance_service import (
    get_system_maintenance_settings,
    get_system_maintenance_status,
    get_system_operation_state,
    run_system_maintenance_action_now,
    set_system_operation_mode,
    update_system_maintenance_settings,
)
from services.system_readiness_service import get_system_readiness

router = APIRouter(prefix="/system/maintenance", tags=["System Maintenance"])
sse_bearer = HTTPBearer(auto_error=False)


async def current_admin_or_token_dep(
    credentials: HTTPAuthorizationCredentials = Depends(sse_bearer),
) -> UserSession:
    if not credentials:
        raise HTTPException(status_code=401, detail="No se proporcionó token de autenticación.")

    session = await get_current_user(credentials.credentials)
    if not has_role(session, "ADMIN"):
        raise ForbiddenException("No tienes los roles requeridos para esta operación")
    return session


@router.get(
    "",
    response_model=SystemMaintenanceConfigResponse,
    status_code=status.HTTP_200_OK,
)
def get_config_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return get_system_maintenance_settings(db)


@router.put(
    "",
    response_model=SystemMaintenanceConfigResponse,
    status_code=status.HTTP_200_OK,
)
def update_config_endpoint(
    body: SystemMaintenanceConfigRequest,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return update_system_maintenance_settings(db, body, updated_by_id=session.user_id)


@router.get(
    "/status",
    response_model=SystemMaintenanceStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def get_status_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await get_system_maintenance_status(db)


@router.get(
    "/operation-state",
    response_model=SystemOperationStateResponse,
    status_code=status.HTTP_200_OK,
)
def get_operation_state_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return get_system_operation_state(db)


@router.get(
    "/operation-state/public",
    response_model=SystemOperationStateResponse,
    status_code=status.HTTP_200_OK,
)
def get_public_operation_state_endpoint(
    db: Session = Depends(get_db),
):
    return get_system_operation_state(db)


@router.post(
    "/operation-state",
    response_model=SystemOperationStateResponse,
    status_code=status.HTTP_200_OK,
)
async def set_operation_state_endpoint(
    body: SystemOperationModeRequest,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await set_system_operation_mode(
        db,
        mode=body.mode,
        reason=body.reason,
        actor_user_id=session.user_id,
    )


@router.get(
    "/readiness",
    status_code=status.HTTP_200_OK,
)
async def get_readiness_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await get_system_readiness(db)


@router.post(
    "/readiness/run",
    status_code=status.HTTP_200_OK,
)
async def run_readiness_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await get_system_readiness(db)


@router.get(
    "/events",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
async def maintenance_events_endpoint(
    request: Request,
    session: UserSession = Depends(current_admin_or_token_dep),
):
    return StreamingResponse(
        stream_system_maintenance_events(session, request),
        media_type="text/event-stream",
        headers=maintenance_sse_headers(),
    )


@router.post(
    "/run/session-cleanup",
    response_model=MaintenanceRunNowResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_session_cleanup_now_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await run_system_maintenance_action_now(
        db,
        action_key="session_cleanup",
        requested_by_id=session.user_id,
    )


@router.post(
    "/run/temp-cleanup",
    response_model=MaintenanceRunNowResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_temp_cleanup_now_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await run_system_maintenance_action_now(
        db,
        action_key="temp_cleanup",
        requested_by_id=session.user_id,
    )

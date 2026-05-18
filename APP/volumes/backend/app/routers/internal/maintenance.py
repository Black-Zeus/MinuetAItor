from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.internal_auth import verify_internal_secret
from db.session import get_db
from schemas.internal_maintenance import MaintenanceTickResponse
from services.system_maintenance_service import run_system_maintenance_tick

router = APIRouter(
    prefix="/internal/v1/maintenance",
    tags=["Internal — Maintenance"],
    dependencies=[Depends(verify_internal_secret)],
)


@router.post(
    "/tick",
    response_model=MaintenanceTickResponse,
    status_code=status.HTTP_200_OK,
)
async def maintenance_tick_endpoint(
    db: Session = Depends(get_db),
) -> MaintenanceTickResponse:
    return await run_system_maintenance_tick(db)

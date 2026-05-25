from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.internal_auth import verify_internal_secret
from db.session import get_db
from schemas.internal_backups import BackupTickResponse
from services.system_backups_service import run_system_backups_tick

router = APIRouter(
    prefix="/internal/v1/system/backups",
    tags=["Internal - System Backups"],
    dependencies=[Depends(verify_internal_secret)],
)


@router.post(
    "/tick",
    response_model=BackupTickResponse,
    status_code=status.HTTP_200_OK,
)
async def system_backups_tick_endpoint(
    db: Session = Depends(get_db),
) -> BackupTickResponse:
    return await run_system_backups_tick(db)

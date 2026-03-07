# routers/internal/minutes.py
"""
Endpoints internos para el pipeline de minutas.

Prefijo: /internal/v1/minutes
Acceso:  Solo desde la red Docker interna (nunca expuesto por nginx).
Auth:    X-Internal-Secret header (verify_internal_secret dependency).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.internal_auth import verify_internal_secret
from db.session import get_db
from schemas.internal_minutes import MinuteCommitRequest, MinuteCommitResponse
from services.internal_minutes_service import commit_minute_tx2

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/internal/v1/minutes",
    tags=["Internal — Minutes"],
    dependencies=[Depends(verify_internal_secret)],  # Aplica a TODOS los endpoints del router
)


@router.post(
    "/commit",
    response_model=MinuteCommitResponse,
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Persistir resultado TX2 del worker",
    description=(
        "Recibe el output de OpenAI desde el worker y ejecuta TX2 completa: "
        "crea RecordVersion, RecordArtifacts, actualiza MinuteTransaction y Record, "
        "sube JSON a MinIO y publica evento SSE."
    ),
)
async def commit_endpoint(
    body: MinuteCommitRequest,
    db: Session = Depends(get_db),
) -> MinuteCommitResponse:
    logger.info(
        "TX2 recibida desde worker | tx=%s record=%s",
        body.transaction_id,
        body.record_id,
    )
    return await commit_minute_tx2(db, body)
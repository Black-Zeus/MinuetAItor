# routers/v1/minutes.py
"""
Endpoints del módulo de minutas.

POST /v1/minutes/generate
    Recibe multipart/form-data:
      - input_json : string JSON (MinuteGenerateRequest serializado)
      - files      : archivos adjuntos (transcripción, resumen, etc.)
    Retorna 202 con { transactionId, recordId, status, message }

GET  /v1/minutes/{transaction_id}/status
    Retorna el estado actual de la transaction.
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.minutes import MinuteGenerateRequest, MinuteGenerateResponse, MinuteStatusResponse
from services.auth_service import get_current_user
from services.minutes_service import generate_minute, get_minute_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/minutes", tags=["Minutes"])
bearer = HTTPBearer()

# ─── Auth dep ─────────────────────────────────────────────────────────────────

async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


# ─── POST /generate ───────────────────────────────────────────────────────────

@router.post(
    "/generate",
    response_model = MinuteGenerateResponse,
    status_code    = status.HTTP_202_ACCEPTED,
    summary        = "Generar minuta desde transcripción",
)
async def generate_endpoint(
    input_json: str            = Form(..., description="JSON serializado con MinuteGenerateRequest"),
    files:      list[UploadFile] = File(..., description="Archivos adjuntos (transcripción, resumen, etc.)"),
    db:         Session        = Depends(get_db),
    session:    UserSession    = Depends(current_user_dep),
):
    """
    Recibe el formulario de nueva minuta desde el frontend (NewMinute.jsx).

    - input_json : JSON string con meetingInfo, projectInfo, participants, profileInfo, preparedBy
    - files      : 1-10 archivos (transcripción requerida, resumen opcional)

    Procesa síncronamente en esta versión (TODO: mover a worker async).
    Retorna 202 con transactionId + recordId para que el frontend navegue al editor.
    """

    # Parsear y validar el JSON
    try:
        data    = json.loads(input_json)
        request = MinuteGenerateRequest.model_validate(data)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail      = f"input_json no es JSON válido: {e}",
        )
    except Exception as e:
        raise HTTPException(
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail      = f"Validación fallida: {e}",
        )

    # Validar que hay al menos un archivo
    if not files:
        raise HTTPException(
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail      = "Se requiere al menos un archivo adjunto (transcripción).",
        )

    # Validar que hay al menos un asistente
    if not request.participants.attendees:
        raise HTTPException(
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail      = "Se requiere al menos un asistente en participants.attendees.",
        )

    logger.info(
        f"[minutes] Nueva solicitud | user={session.user_id} "
        f"client={request.project_info.client} "
        f"project={request.project_info.project} "
        f"files={len(files)}"
    )

    return await generate_minute(
        db              = db,
        request         = request,
        files           = files,
        requested_by_id = session.user_id,
    )


# ─── GET /{transaction_id}/status ────────────────────────────────────────────

@router.get(
    "/{transaction_id}/status",
    response_model = MinuteStatusResponse,
    status_code    = status.HTTP_200_OK,
    summary        = "Estado de la transacción de generación",
)
async def status_endpoint(
    transaction_id: str,
    db:             Session     = Depends(get_db),
    session:        UserSession = Depends(current_user_dep),
):
    """
    Retorna el estado actual de una transacción de generación de minuta.
    Útil para polling desde el frontend mientras la IA procesa.
    """
    return await get_minute_status(db, transaction_id)
# routers/v1/minutes.py
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.minutes import (
    MinuteDetailResponse,
    MinuteGenerateRequest,
    MinuteGenerateResponse,
    MinuteSaveRequest,
    MinuteStatusResponse,
    MinuteTransitionRequest,
    MinuteTransitionResponse,
    MinuteListResponse,
)
from services.auth_service import get_current_user
from services.minutes_service import (
    generate_minute,
    get_minute_detail,
    get_minute_status,
    save_minute_draft,
    transition_minute,
    list_minutes,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/minutes", tags=["Minutes"])
bearer = HTTPBearer()


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
    input_json: str              = Form(..., description="JSON serializado con MinuteGenerateRequest"),
    files:      list[UploadFile] = File(..., description="Archivos adjuntos (transcripción, resumen, etc.)"),
    db:         Session          = Depends(get_db),
    session:    UserSession      = Depends(current_user_dep),
):
    try:
        data    = json.loads(input_json)
        request = MinuteGenerateRequest.model_validate(data)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"input_json no es JSON válido: {e}")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Validación fallida: {e}")

    if not files:
        raise HTTPException(status_code=422, detail="Se requiere al menos un archivo adjunto.")
    if not request.participants.attendees:
        raise HTTPException(status_code=422, detail="Se requiere al menos un asistente en participants.attendees.")

    logger.info(f"[minutes] Nueva solicitud | user={session.user_id} client={request.project_info.client} files={len(files)}")

    return await generate_minute(db=db, request=request, files=files, requested_by_id=session.user_id)


# ─── GET /{record_id} ─────────────────────────────────────────────────────────
# Declarado antes de /{transaction_id}/status para garantizar orden de resolución.

@router.get(
    "/{record_id}",
    response_model = MinuteDetailResponse,
    status_code    = status.HTTP_200_OK,
    summary        = "Obtener minuta con contenido embebido",
)
def get_detail_endpoint(
    record_id: str,
    db:        Session     = Depends(get_db),
    session:   UserSession = Depends(current_user_dep),
):
    """
    Retorna metadata del record + canonical JSON desde MinIO.
    Fuente según estado: ready-for-edit→v1.json | pending→draft_current.json |
    preview/completed→vN.json | llm-failed/processing-error→content:null
    """
    return get_minute_detail(db=db, record_id=record_id)


# ─── PUT /{record_id}/save ────────────────────────────────────────────────────

@router.put(
    "/{record_id}/save",
    status_code = status.HTTP_200_OK,
    summary     = "Autosave del editor (solo estado pending)",
)
def save_endpoint(
    record_id: str,
    body:      MinuteSaveRequest,
    db:        Session     = Depends(get_db),
    session:   UserSession = Depends(current_user_dep),
):
    """
    Sobreescribe draft_current.json en minuetaitor-draft.
    Solo válido en estado 'pending'. Idempotente. No crea versión ni cambia estado.
    """
    save_minute_draft(db=db, record_id=record_id, content=body.content)
    return {"ok": True}


# ─── POST /{record_id}/transition ────────────────────────────────────────────

@router.post(
    "/{record_id}/transition",
    response_model = MinuteTransitionResponse,
    status_code    = status.HTTP_200_OK,
    summary        = "Transicionar estado de la minuta",
)
async def transition_endpoint(
    record_id: str,
    body:      MinuteTransitionRequest,
    db:        Session     = Depends(get_db),
    session:   UserSession = Depends(current_user_dep),
):
    """
    Cambia el estado del record aplicando la lógica propia de cada transición.

    Transiciones válidas:
    - ready-for-edit → pending        (inicia edición, copia draft)
    - pending        → preview        (congela snapshot, encola PDF borrador)
    - pending        → cancelled
    - pending        → deleted
    - preview        → pending        (retoma edición)
    - preview        → completed      (publica, encola PDF final)
    - preview        → cancelled
    - preview        → deleted
    - cancelled      → deleted
    - llm-failed     → deleted
    - processing-error → deleted
    """
    return await transition_minute(
        db             = db,
        record_id      = record_id,
        target_status  = body.target_status,
        commit_message = body.commit_message,
        actor_user_id  = session.user_id,
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
    """Polling del estado de una transacción de generación de minuta."""
    return await get_minute_status(db, transaction_id)

# ─── GET / (list) ─────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model = MinuteListResponse,
    status_code    = status.HTTP_200_OK,
    summary        = "Listar minutas",
)
def list_endpoint(
    skip:          int          = 0,
    limit:         int          = 50,
    status_filter: str | None   = None,
    client_id:     str | None   = None,
    project_id:    str | None   = None,
    db:            Session      = Depends(get_db),
    session:       UserSession  = Depends(current_user_dep),
):
    return list_minutes(
        db=db, skip=skip, limit=limit,
        status_filter=status_filter,
        client_id=client_id,
        project_id=project_id,
    )
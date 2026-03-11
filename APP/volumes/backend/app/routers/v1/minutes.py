# routers/v1/minutes.py
from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from db.redis import get_redis
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
    MinuteVersionsResponse,
)
from services.auth_service import get_current_user
from services.minutes_service import (
    generate_minute,
    get_minute_attachment_blob,
    generate_minute_pdf_preview,
    get_minute_detail,
    get_minute_status,
    get_minute_versions,
    save_minute_draft,
    transition_minute,
    list_minutes,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/minutes", tags=["Minutes"])
bearer = HTTPBearer(auto_error=False)   # auto_error=False para no fallar cuando viene por ?token=

SSE_CHANNEL         = "events:minutes"
SSE_KEEPALIVE_SEC   = 15
SSE_MAX_WAIT_SEC    = 360
SSE_TERMINAL_EVENTS = {"completed", "failed"}


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


async def current_user_or_token_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    token: str | None = Query(None, description="JWT para autenticación via SSE (EventSource no soporta headers)"),
) -> UserSession:
    """
    Dependencia de autenticación flexible para el endpoint SSE.

    EventSource del browser no permite enviar el header Authorization,
    por lo que acepta el JWT como query param ?token=...

    Prioridad: header Authorization > query param ?token=
    """
    jwt = (credentials.credentials if credentials else None) or token
    if not jwt:
        raise HTTPException(status_code=401, detail="No se proporcionó token de autenticación.")
    return await get_current_user(jwt)


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

    logger.info(
        "[minutes] Nueva solicitud | user=%s client=%s files=%d",
        session.user_id, request.project_info.client, len(files),
    )

    return await generate_minute(db=db, request=request, files=files, requested_by_id=session.user_id)


# ─── GET /{record_id} ─────────────────────────────────────────────────────────

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
    return get_minute_detail(db=db, record_id=record_id)


# ─── PUT /{record_id}/save ────────────────────────────────────────────────────

@router.put(
    "/{record_id}/save",
    status_code = status.HTTP_200_OK,
    summary     = "Autosave del editor (solo estado pending)",
)
async def save_endpoint(
    record_id: str,
    body:      MinuteSaveRequest,
    db:        Session     = Depends(get_db),
    session:   UserSession = Depends(current_user_dep),
):
    await save_minute_draft(db=db, record_id=record_id, content=body.content)
    return {"ok": True}


@router.post(
    "/{record_id}/pdf-preview",
    status_code = status.HTTP_200_OK,
    summary     = "Generar PDF temporal de vista previa con el payload actual del editor",
)
async def pdf_preview_endpoint(
    record_id: str,
    body:      MinuteSaveRequest,
    db:        Session     = Depends(get_db),
    session:   UserSession = Depends(current_user_dep),
):
    pdf_bytes = await generate_minute_pdf_preview(
        db=db,
        record_id=record_id,
        content=body.content,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="minute-preview.pdf"'},
    )


@router.get(
    "/{record_id}/attachments/{sha256}",
    status_code = status.HTTP_200_OK,
    summary     = "Sirve un adjunto de entrada real asociado a la minuta",
)
def attachment_endpoint(
    record_id: str,
    sha256:    str,
    db:        Session = Depends(get_db),
    session:   UserSession = Depends(current_user_dep),
):
    file_bytes, mime_type, filename = get_minute_attachment_blob(
        db=db,
        record_id=record_id,
        sha256=sha256,
    )
    return Response(
        content=file_bytes,
        media_type=mime_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ─── POST /{record_id}/transition ─────────────────────────────────────────────

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
    return await transition_minute(
        db             = db,
        record_id      = record_id,
        target_status  = body.target_status,
        commit_message = body.commit_message,
        actor_user_id  = session.user_id,
        review_email   = body.review_email,
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
    """Consulta puntual del estado. Útil para recuperar estado al recargar la página."""
    return await get_minute_status(db, transaction_id)


# ─── GET /{transaction_id}/events  (SSE) ──────────────────────────────────────

@router.get(
    "/{transaction_id}/events",
    summary        = "Stream SSE — escucha el resultado de generación en tiempo real",
    response_class = StreamingResponse,
)
async def events_endpoint(
    transaction_id: str,
    db:             Session     = Depends(get_db),
    session:        UserSession = Depends(current_user_or_token_dep),
):
    """
    Server-Sent Events — el cliente escucha aquí hasta recibir "completed" o "failed".

    Autenticación:
        - Header Authorization: Bearer <token>  (clientes que pueden enviar headers)
        - Query param ?token=<jwt>              (EventSource del browser, que NO soporta headers)

    Eventos:
        keepalive  → ping cada 15s (el cliente los ignora)
        completed  → { transaction_id, record_id }
        failed     → { transaction_id, error }

    Si la transacción ya terminó al conectarse, responde inmediatamente sin suscribir a Pub/Sub.
    """
    tx_status = await get_minute_status(db, transaction_id)

    # Si ya terminó → responder de inmediato sin suscribir a Pub/Sub
    if tx_status.status in SSE_TERMINAL_EVENTS:
        async def immediate() -> AsyncGenerator[str, None]:
            data = {
                "transaction_id": transaction_id,
                "record_id":      tx_status.record_id,
                "status":         tx_status.status,
            }
            if tx_status.error_message:
                data["error"] = tx_status.error_message
            yield _sse_event(tx_status.status, data)
        return StreamingResponse(immediate(), media_type="text/event-stream", headers=_sse_headers())

    return StreamingResponse(
        _sse_stream(transaction_id),
        media_type = "text/event-stream",
        headers    = _sse_headers(),
    )


# ─── GET /{record_id}/pdf ────────────────────────────────────────────────────

@router.get(
    "/{record_id}/pdf",
    status_code = status.HTTP_200_OK,
    summary     = "Sirve el PDF generado directamente desde MinIO (draft o publicado)",
)
def pdf_endpoint(
    record_id: str,
    type:      str     = Query("draft", description="'draft' para borrador, 'published' para versión final"),
    db:        Session = Depends(get_db),
    session:   UserSession = Depends(current_user_dep),
):
    """
    Actúa como proxy entre el frontend y MinIO para servir el PDF generado.
    El JWT viaja en el header Authorization normal; MinIO permanece interno.

    Paths en MinIO:
      draft     → minuetaitor-draft/drafts/{record_id}/draft_current.pdf
      published → minuetaitor-published/published/{record_id}/final.pdf
    """
    from db.minio_client import get_minio_client

    if type == "published":
        bucket = "minuetaitor-published"
        key    = f"published/{record_id}/final.pdf"
    else:
        bucket = "minuetaitor-draft"
        key    = f"drafts/{record_id}/draft_current.pdf"

    minio = get_minio_client()
    try:
        obj       = minio.get_object(bucket, key)
        pdf_bytes = obj.read()
        obj.close()
        obj.release_conn()
    except Exception:
        raise HTTPException(
            status_code = 404,
            detail = {
                "error":   "pdf_not_found",
                "message": "El PDF aún no ha sido generado. Guarda la minuta para generarlo.",
            },
        )

    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {"Content-Disposition": "inline"},
    )


# ─── GET /{record_id}/versions ───────────────────────────────────────────────

@router.get(
    "/{record_id}/versions",
    response_model = MinuteVersionsResponse,
    status_code    = status.HTTP_200_OK,
    summary        = "Historial de versiones de una minuta",
)
def versions_endpoint(
    record_id: str,
    db:        Session     = Depends(get_db),
    session:   UserSession = Depends(current_user_dep),
):
    return get_minute_versions(db=db, record_id=record_id)


# ─── GET / (list) ─────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model = MinuteListResponse,
    status_code    = status.HTTP_200_OK,
    summary        = "Listar minutas",
)
def list_endpoint(
    skip:          int         = 0,
    limit:         int         = 50,
    q:             str | None  = None,
    status_filter: str | None  = None,
    client_id:     str | None  = None,
    project_id:    str | None  = None,
    mine_as_preparer: bool     = False,
    mine_as_participant: bool  = False,
    exclude_mine_as_preparer: bool = False,
    db:            Session     = Depends(get_db),
    session:       UserSession = Depends(current_user_dep),
):
    return list_minutes(
        db=db, skip=skip, limit=limit,
        q=q,
        status_filter=status_filter,
        client_id=client_id,
        project_id=project_id,
        prepared_by_user_id=session.user_id if mine_as_preparer else None,
        participant_user_id=session.user_id if mine_as_participant else None,
        exclude_prepared_by_user_id=session.user_id if exclude_mine_as_preparer else None,
    )


# ── Helpers SSE ───────────────────────────────────────────────────────────────

def _sse_headers() -> dict:
    return {
        "Cache-Control":               "no-cache",
        "X-Accel-Buffering":           "no",
        "Access-Control-Allow-Origin": "*",
    }


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _sse_stream(transaction_id: str) -> AsyncGenerator[str, None]:
    redis  = await get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(SSE_CHANNEL)
    logger.info("[sse] Suscrito | tx=%s", transaction_id)

    try:
        elapsed   = 0.0
        last_ping = 0.0

        while elapsed < SSE_MAX_WAIT_SEC:
            # Keepalive
            if elapsed - last_ping >= SSE_KEEPALIVE_SEC:
                yield "event: keepalive\ndata: {}\n\n"
                last_ping = elapsed

            try:
                msg = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=2.0,
                )
            except asyncio.TimeoutError:
                elapsed += 1.0
                continue

            if not msg or msg["type"] != "message":
                elapsed += 0.1
                await asyncio.sleep(0.1)
                continue

            try:
                event_data = json.loads(msg["data"])
            except (json.JSONDecodeError, TypeError):
                elapsed += 0.1
                await asyncio.sleep(0.1)
                continue

            # Filtrar solo eventos de esta transacción
            if event_data.get("transaction_id") != transaction_id:
                elapsed += 0.1
                await asyncio.sleep(0.1)
                continue

            event_name = event_data.get("event", "status")
            yield _sse_event(event_name, event_data)
            logger.info("[sse] Evento enviado | event=%s tx=%s", event_name, transaction_id)

            if event_name in SSE_TERMINAL_EVENTS:
                break

            elapsed += 0.1
            await asyncio.sleep(0.1)

        else:
            logger.warning("[sse] Timeout | tx=%s", transaction_id)
            yield _sse_event("failed", {
                "transaction_id": transaction_id,
                "error": "Tiempo máximo de espera agotado. Consulta el estado con /status.",
            })

    finally:
        try:
            await pubsub.unsubscribe(SSE_CHANNEL)
            await pubsub.close()
        except Exception:
            pass
        logger.info("[sse] Stream cerrado | tx=%s", transaction_id)

# routers/internal/context.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.internal_auth import verify_internal_secret
from db.session import get_db
from schemas.internal_context import ContextMinuteCanonicalResponse
from schemas.internal_context import (
    ContextCleanupJobCompleteRequest,
    ContextIndexJobCompleteRequest,
    ContextIndexJobFailRequest,
    ContextIndexJobStatusResponse,
)
from schemas.internal_minutes import ActiveAIProviderConfigResponse
from services.ai_context_sync_service import (
    complete_context_cleanup_job,
    complete_context_index_job,
    expand_context_reindex_job,
    fail_context_index_job,
    mark_context_index_job_running,
    scheduled_context_sync_tick,
    sync_context_status,
)
from services.ai_provider_bindings_service import get_ai_provider_runtime_config_for_purpose
from services.ai_context_canonical_service import (
    CANONICAL_SCHEMA_VERSION,
    build_minute_canonical_context,
)
from services.context_query_service import purge_context_query_history, run_queued_context_query


router = APIRouter(
    prefix="/internal/v1/context",
    tags=["Internal — Context"],
    dependencies=[Depends(verify_internal_secret)],
)


@router.get(
    "/minutes/{record_id}/canonical",
    response_model=ContextMinuteCanonicalResponse,
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Obtener JSON canonico de minuta final para Knowledge Search",
)
def get_minute_canonical_context_endpoint(
    record_id: str,
    db: Session = Depends(get_db),
) -> ContextMinuteCanonicalResponse:
    canonical = build_minute_canonical_context(db, record_id)
    return ContextMinuteCanonicalResponse(
        record_id=record_id,
        version_id=str(canonical["version"]["id"]),
        schema_version=CANONICAL_SCHEMA_VERSION,
        source_hash=str(canonical["sourceHash"]),
        canonical=canonical,
    )


@router.get(
    "/active-provider/{purpose}",
    response_model=ActiveAIProviderConfigResponse,
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Obtener provider activo por propósito de contexto",
)
def active_context_provider_endpoint(
    purpose: str,
    db: Session = Depends(get_db),
) -> ActiveAIProviderConfigResponse:
    return get_ai_provider_runtime_config_for_purpose(db, purpose)


@router.post(
    "/index-jobs/{job_id}/start",
    response_model=ContextIndexJobStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Marcar job de contexto como running",
)
def start_context_index_job_endpoint(
    job_id: str,
    db: Session = Depends(get_db),
) -> ContextIndexJobStatusResponse:
    return ContextIndexJobStatusResponse(**mark_context_index_job_running(db, job_id))


@router.post(
    "/index-jobs/{job_id}/complete",
    response_model=ContextIndexJobStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Registrar indexación de contexto completada",
)
def complete_context_index_job_endpoint(
    job_id: str,
    body: ContextIndexJobCompleteRequest,
    db: Session = Depends(get_db),
) -> ContextIndexJobStatusResponse:
    return ContextIndexJobStatusResponse(**complete_context_index_job(db, job_id=job_id, body=body))


@router.post(
    "/index-jobs/{job_id}/cleanup-complete",
    response_model=ContextIndexJobStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Registrar limpieza de contexto completada",
)
def complete_context_cleanup_job_endpoint(
    job_id: str,
    body: ContextCleanupJobCompleteRequest,
    db: Session = Depends(get_db),
) -> ContextIndexJobStatusResponse:
    return ContextIndexJobStatusResponse(**complete_context_cleanup_job(db, job_id=job_id, body=body))


@router.post(
    "/index-jobs/{job_id}/fail",
    response_model=ContextIndexJobStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Registrar error de indexación de contexto",
)
async def fail_context_index_job_endpoint(
    job_id: str,
    body: ContextIndexJobFailRequest,
    db: Session = Depends(get_db),
) -> ContextIndexJobStatusResponse:
    return ContextIndexJobStatusResponse(**await fail_context_index_job(db, job_id=job_id, body=body))


@router.post(
    "/reindex-jobs/{job_id}/expand",
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Expandir job padre de reindexación contextual",
)
async def expand_context_reindex_job_endpoint(
    job_id: str,
    db: Session = Depends(get_db),
) -> dict:
    return await expand_context_reindex_job(db, job_id=job_id)


@router.post(
    "/query-runs/{query_id}/run",
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Ejecutar consulta contextual encolada",
)
def run_context_query_endpoint(
    query_id: str,
    db: Session = Depends(get_db),
) -> dict:
    return run_queued_context_query(db, query_id)


@router.post(
    "/query-runs/purge",
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Purgar historial de consultas contextuales",
)
def purge_context_query_history_endpoint(
    db: Session = Depends(get_db),
) -> dict:
    return purge_context_query_history(db)


@router.post(
    "/sync/tick",
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Ejecutar tick programado de sincronizacion semantica",
)
async def scheduled_context_sync_tick_endpoint(
    db: Session = Depends(get_db),
) -> dict:
    return await scheduled_context_sync_tick(db)


@router.post(
    "/sync/status",
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Reconciliar estados de sincronización contextual",
)
async def sync_context_status_endpoint(
    body: dict | None = None,
    db: Session = Depends(get_db),
) -> dict:
    return await sync_context_status(db, job_id=str((body or {}).get("jobId") or "") or None)

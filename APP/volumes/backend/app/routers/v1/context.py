from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import current_user_dep, require_roles
from db.session import get_db
from schemas.auth import UserSession
from schemas.context import (
    ContextQdrantHealthResponse,
    ContextQueryRequest,
    ContextQueryResponse,
    ContextSyncActionResponse,
    ContextSyncMinutesResponse,
    ContextSyncStatusResponse,
)
from services.access_control_service import ensure_client_read_access, ensure_project_read_access, ensure_record_read_access
from services.ai_context_sync_service import (
    cleanup_context_minute,
    ensure_context_sync_enabled,
    get_ai_context_sync_counts,
    get_qdrant_healthcheck,
    list_context_sync_minutes,
    queue_context_status_sync,
    rebuild_context_collection,
    reindex_all_context,
    reindex_context_client,
    reindex_context_minute,
    reindex_context_project,
    retry_failed_context_index_jobs,
)
from services.context_query_service import get_context_query_run, query_context

router = APIRouter(prefix="/context", tags=["Context"])


@router.post(
    "/query",
    response_model=ContextQueryResponse,
    status_code=status.HTTP_200_OK,
)
async def query_context_endpoint(
    body: ContextQueryRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
) -> ContextQueryResponse:
    return ContextQueryResponse(**await query_context(db, body, session))


@router.get(
    "/query/{query_id}",
    response_model=ContextQueryResponse,
    status_code=status.HTTP_200_OK,
)
def get_context_query_endpoint(
    query_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
) -> ContextQueryResponse:
    return ContextQueryResponse(**get_context_query_run(db, query_id, session))


@router.get(
    "/sync/status",
    response_model=ContextSyncStatusResponse,
    status_code=status.HTTP_200_OK,
)
def get_context_sync_status_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
) -> ContextSyncStatusResponse:
    ensure_context_sync_enabled(db)
    return ContextSyncStatusResponse(**get_ai_context_sync_counts(db))


@router.get(
    "/sync/qdrant-health",
    response_model=ContextQdrantHealthResponse,
    status_code=status.HTTP_200_OK,
)
def get_context_qdrant_health_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
) -> ContextQdrantHealthResponse:
    ensure_context_sync_enabled(db)
    return ContextQdrantHealthResponse(**get_qdrant_healthcheck())


@router.get(
    "/sync/minutes",
    response_model=ContextSyncMinutesResponse,
    status_code=status.HTTP_200_OK,
)
def list_context_sync_minutes_endpoint(
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
) -> ContextSyncMinutesResponse:
    ensure_context_sync_enabled(db)
    return ContextSyncMinutesResponse(
        **list_context_sync_minutes(
            db,
            session,
            status_filter=status_filter,
            skip=skip,
            limit=limit,
        )
    )


@router.post(
    "/sync/retry-failed",
    response_model=ContextSyncActionResponse,
    status_code=status.HTTP_200_OK,
)
async def retry_failed_context_index_jobs_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
) -> ContextSyncActionResponse:
    return ContextSyncActionResponse(**await retry_failed_context_index_jobs(db, requested_by=session.user_id))


@router.post(
    "/sync/reindex-minute/{record_id}",
    response_model=ContextSyncActionResponse,
    status_code=status.HTTP_200_OK,
)
async def reindex_context_minute_endpoint(
    record_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
) -> ContextSyncActionResponse:
    ensure_record_read_access(db, session, record_id)
    return ContextSyncActionResponse(**await reindex_context_minute(db, record_id, requested_by=session.user_id))


@router.post(
    "/sync/cleanup-minute/{record_id}",
    response_model=ContextSyncActionResponse,
    status_code=status.HTTP_200_OK,
)
async def cleanup_context_minute_endpoint(
    record_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
) -> ContextSyncActionResponse:
    ensure_record_read_access(db, session, record_id)
    return ContextSyncActionResponse(**await cleanup_context_minute(db, record_id, requested_by=session.user_id))


@router.post(
    "/sync/reindex-project/{project_id}",
    response_model=ContextSyncActionResponse,
    status_code=status.HTTP_200_OK,
)
async def reindex_context_project_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
) -> ContextSyncActionResponse:
    ensure_project_read_access(db, session, project_id)
    return ContextSyncActionResponse(**await reindex_context_project(db, project_id, requested_by=session.user_id))


@router.post(
    "/sync/reindex-client/{client_id}",
    response_model=ContextSyncActionResponse,
    status_code=status.HTTP_200_OK,
)
async def reindex_context_client_endpoint(
    client_id: str,
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
) -> ContextSyncActionResponse:
    ensure_client_read_access(db, session, client_id)
    return ContextSyncActionResponse(**await reindex_context_client(db, client_id, requested_by=session.user_id))


@router.post(
    "/sync/reindex-all",
    response_model=ContextSyncActionResponse,
    status_code=status.HTTP_200_OK,
)
async def reindex_all_context_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
) -> ContextSyncActionResponse:
    return ContextSyncActionResponse(**await reindex_all_context(db, requested_by=session.user_id))


@router.post(
    "/sync/rebuild-collection",
    response_model=ContextSyncActionResponse,
    status_code=status.HTTP_200_OK,
)
async def rebuild_context_collection_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
) -> ContextSyncActionResponse:
    return ContextSyncActionResponse(**await rebuild_context_collection(db, requested_by=session.user_id))


@router.post(
    "/sync/reconcile-status",
    response_model=ContextSyncActionResponse,
    status_code=status.HTTP_200_OK,
)
async def reconcile_context_status_endpoint(
    db: Session = Depends(get_db),
    session: UserSession = Depends(require_roles("ADMIN")),
) -> ContextSyncActionResponse:
    return ContextSyncActionResponse(**await queue_context_status_sync(db, requested_by=session.user_id))

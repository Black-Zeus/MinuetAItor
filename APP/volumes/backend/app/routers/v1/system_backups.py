from __future__ import annotations

from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.authz import require_roles
from core.authz import has_role
from core.exceptions import ForbiddenException
from db.session import get_db
from schemas.auth import UserSession
from schemas.system_backups import (
    BackupHistoryResponse,
    BackupImportResponse,
    BackupInspectResponse,
    BackupOperationResponse,
    BackupPurgePreviewResponse,
    BackupRunNowResponse,
    BackupSyncResponse,
    SystemBackupsConfigRequest,
    SystemBackupsConfigResponse,
    SystemBackupsStatusResponse,
)
from services.auth_service import get_current_user
from services.system_backup_events_service import backup_sse_headers, stream_system_backup_events
from services.system_backups_service import (
    cancel_system_backup_operation,
    get_system_backups_config,
    get_system_backups_history,
    get_system_backups_purge_preview,
    get_system_backups_status,
    get_system_backup_operation,
    get_system_backup_artifact_download,
    import_system_backup_package_from_path,
    inspect_system_backup_artifact,
    run_system_backup_artifact_purge,
    run_system_backup_artifact_restore,
    run_system_backups_purge,
    run_system_backup_now,
    sync_system_backup_artifacts,
    update_system_backups_config,
)

router = APIRouter(prefix="/system/backups", tags=["System Backups"])
sse_bearer = HTTPBearer(auto_error=False)
IMPORT_TEMP_ROOT = Path("/app/remote_data/backups/.incoming")


async def current_admin_or_token_dep(
    credentials: HTTPAuthorizationCredentials = Depends(sse_bearer),
    token: str | None = Query(None, description="JWT para autenticación vía SSE"),
) -> UserSession:
    jwt = (credentials.credentials if credentials else None) or token
    if not jwt:
        raise HTTPException(status_code=401, detail="No se proporcionó token de autenticación.")

    session = await get_current_user(jwt)
    if not has_role(session, "ADMIN"):
        raise ForbiddenException("No tienes los roles requeridos para esta operación")
    return session


@router.get(
    "/config",
    response_model=SystemBackupsConfigResponse,
    status_code=status.HTTP_200_OK,
)
def get_config_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return get_system_backups_config(db)


@router.put(
    "/config",
    response_model=SystemBackupsConfigResponse,
    status_code=status.HTTP_200_OK,
)
def update_config_endpoint(
    body: SystemBackupsConfigRequest,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return update_system_backups_config(db, body, session=session)


@router.get(
    "/status",
    response_model=SystemBackupsStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def get_status_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await get_system_backups_status(db)


@router.get(
    "/history",
    response_model=BackupHistoryResponse,
    status_code=status.HTTP_200_OK,
)
def get_history_endpoint(
    limit: int = Query(50, ge=1, le=200),
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return get_system_backups_history(db, limit=limit)


@router.post(
    "/sync",
    response_model=BackupSyncResponse,
    status_code=status.HTTP_200_OK,
)
def sync_backup_artifacts_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return sync_system_backup_artifacts(db, session=session)


@router.post(
    "/import",
    response_model=BackupImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_backup_package_endpoint(
    file: UploadFile = File(...),
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    original_filename = Path(str(file.filename or "")).name
    if not original_filename:
        raise HTTPException(status_code=400, detail="No se recibió nombre de archivo.")

    IMPORT_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    temp_path = IMPORT_TEMP_ROOT / f"{uuid.uuid4().hex}.upload"
    try:
        with temp_path.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)

        if temp_path.stat().st_size <= 0:
            raise HTTPException(status_code=400, detail="El archivo recibido está vacío.")

        return import_system_backup_package_from_path(
            db,
            source_path=temp_path,
            original_filename=original_filename,
            session=session,
        )
    finally:
        await file.close()
        temp_path.unlink(missing_ok=True)


@router.get(
    "/events",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
async def backup_events_endpoint(
    session: UserSession = Depends(current_admin_or_token_dep),
):
    return StreamingResponse(
        stream_system_backup_events(session),
        media_type="text/event-stream",
        headers=backup_sse_headers(),
    )


@router.get(
    "/operations/{operation_id}",
    response_model=BackupOperationResponse,
    status_code=status.HTTP_200_OK,
)
def get_backup_operation_endpoint(
    operation_id: str,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return get_system_backup_operation(db, operation_id=operation_id)


@router.post(
    "/operations/{operation_id}/cancel",
    response_model=BackupOperationResponse,
    status_code=status.HTTP_200_OK,
)
async def cancel_backup_operation_endpoint(
    operation_id: str,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await cancel_system_backup_operation(db, operation_id=operation_id, session=session)


@router.get(
    "/{artifact_id}/inspect",
    response_model=BackupInspectResponse,
    status_code=status.HTTP_200_OK,
)
def inspect_backup_artifact_endpoint(
    artifact_id: str,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return inspect_system_backup_artifact(db, artifact_id=artifact_id)


@router.get(
    "/{artifact_id}/download",
    response_class=FileResponse,
    status_code=status.HTTP_200_OK,
)
def download_backup_artifact_endpoint(
    artifact_id: str,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    download = get_system_backup_artifact_download(db, artifact_id=artifact_id)
    return FileResponse(
        path=download["path"],
        filename=download["filename"],
        media_type="application/gzip",
    )


@router.post(
    "/{artifact_id}/restore",
    response_model=BackupRunNowResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_backup_artifact_restore_endpoint(
    artifact_id: str,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await run_system_backup_artifact_restore(db, artifact_id=artifact_id, session=session)


@router.post(
    "/{artifact_id}/purge",
    response_model=BackupRunNowResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_backup_artifact_purge_endpoint(
    artifact_id: str,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await run_system_backup_artifact_purge(db, artifact_id=artifact_id, session=session)


@router.post(
    "/run/database",
    response_model=BackupRunNowResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_database_backup_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await run_system_backup_now(db, scope="database", session=session)


@router.post(
    "/run/objects",
    response_model=BackupRunNowResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_objects_backup_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await run_system_backup_now(db, scope="objects", session=session)


@router.post(
    "/run/full",
    response_model=BackupRunNowResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_full_backup_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await run_system_backup_now(db, scope="full", session=session)


@router.post(
    "/purge/preview",
    response_model=BackupPurgePreviewResponse,
    status_code=status.HTTP_200_OK,
)
def preview_backup_purge_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return get_system_backups_purge_preview(db)


@router.post(
    "/purge",
    response_model=BackupRunNowResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_backup_purge_endpoint(
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return await run_system_backups_purge(db, session=session)

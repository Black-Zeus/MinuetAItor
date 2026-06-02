from __future__ import annotations

import json
import logging
import ssl
import urllib.error
import urllib.request
import uuid
from datetime import timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from core.config import settings
from core.datetime_utils import utc_now_db
from models.ai_context_settings import AiContextSetting
from models.ai_context_sync import AiContextChunk, AiContextDocument, AiContextIndexJob
from models.ai_provider_configs import AiProviderConfig
from models.clients import Client
from models.projects import Project
from models.record_statuses import RecordStatus
from models.record_versions import RecordVersion
from models.records import Record
from models.roles import Role
from models.user import User
from models.user_roles import UserRole
from models.version_statuses import VersionStatus
from schemas.auth import UserSession
from services.access_control_service import apply_record_scope_filter
from services.email_branding_service import build_email_branding_bundle
from services.email_queue import queue_templated_email
from services.minutes import queue as minute_queue
from services.notification_center_service import create_in_app_notification
from services.public_url_service import build_public_url
from services.ai_usage_events_service import record_ai_usage_event

logger = logging.getLogger(__name__)

CONTEXT_QUEUE_NAME = getattr(settings, "context_queue_name", "queue:context") or "queue:context"
JOB_INDEX_MINUTE_CONTEXT = "index_minute_context"
JOB_REINDEX_MINUTE_CONTEXT = "reindex_minute_context"
JOB_REINDEX_PROJECT_CONTEXT = "reindex_project_context"
JOB_REINDEX_CLIENT_CONTEXT = "reindex_client_context"
JOB_REINDEX_ALL_CONTEXT = "reindex_all_context"
JOB_SYNC_CONTEXT_STATUS = "sync_context_status"
JOB_CLEANUP_MINUTE_CONTEXT = "cleanup_minute_context"
EVENT_MINUTE_FINALIZED = "minute.finalized"

ACTIVE_INDEX_JOB_STATUSES = {"queued", "running", "retrying"}
CONTEXT_FAILURE_TEMPLATE_ID = "context_indexing_failed"


def get_ai_context_sync_counts(db: Session) -> dict:
    rows = (
        db.query(AiContextDocument.status, func.count(AiContextDocument.id))
        .group_by(AiContextDocument.status)
        .all()
    )
    by_status = {str(status): int(count or 0) for status, count in rows}
    total = sum(by_status.values())

    return {
        "total_documents": total,
        "by_status": by_status,
        "failed_documents": by_status.get("failed", 0),
        "outdated_documents": by_status.get("outdated", 0),
        "not_indexed_documents": by_status.get("not_indexed", 0),
    }


def get_qdrant_healthcheck() -> dict[str, Any]:
    url = str(getattr(settings, "qdrant_url", "") or "").rstrip("/")
    checked_at = utc_now_db()
    if not url:
        return {
            "ok": False,
            "status": "not_configured",
            "url": None,
            "collections_count": 0,
            "message": "QDRANT_URL no está configurada.",
            "checked_at": checked_at.isoformat(),
        }

    request_headers = {"Accept": "application/json"}
    api_key = str(getattr(settings, "qdrant_api_key", "") or "").strip()
    if api_key:
        request_headers["api-key"] = api_key

    request = urllib.request.Request(f"{url}/collections", headers=request_headers, method="GET")
    context = ssl.create_default_context() if url.startswith("https://") else None
    try:
        with urllib.request.urlopen(request, timeout=8, context=context) as response:
            raw = response.read().decode("utf-8")
            payload = json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        return {
            "ok": False,
            "status": "http_error",
            "url": url,
            "collections_count": 0,
            "message": f"Qdrant respondió HTTP {exc.code}: {raw[:180]}",
            "checked_at": checked_at.isoformat(),
        }
    except Exception as exc:
        return {
            "ok": False,
            "status": "unreachable",
            "url": url,
            "collections_count": 0,
            "message": f"No se pudo conectar con Qdrant: {exc}",
            "checked_at": checked_at.isoformat(),
        }

    collections = ((payload.get("result") or {}).get("collections") or [])
    return {
        "ok": True,
        "status": "ready",
        "url": url,
        "collections_count": len(collections) if isinstance(collections, list) else 0,
        "message": "Qdrant disponible.",
        "checked_at": checked_at.isoformat(),
    }


def ensure_context_sync_enabled(db: Session) -> None:
    obj = db.query(AiContextSetting).filter(AiContextSetting.id == 1).first()
    if not obj or not bool(obj.context_ai_enabled and obj.sync_enabled):
        raise HTTPException(status_code=409, detail="La sincronización de Knowledge Search no está habilitada.")


def list_context_sync_minutes(
    db: Session,
    session: UserSession,
    *,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> dict[str, Any]:
    final_status_id = _version_status_id(db, "final")
    completed_status_id = _record_status_id(db, "completed")
    query = (
        db.query(Record, RecordVersion, Client, Project, AiContextDocument)
        .join(RecordVersion, RecordVersion.id == Record.active_version_id)
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
        .outerjoin(
            AiContextDocument,
            (AiContextDocument.source_minute_id == Record.id)
            & (AiContextDocument.source_version_id == RecordVersion.id)
            & (AiContextDocument.source_system == "minuetaitor"),
        )
        .filter(Record.deleted_at.is_(None))
        .filter(Record.status_id == completed_status_id)
        .filter(RecordVersion.status_id == final_status_id)
        .filter(RecordVersion.deleted_at.is_(None))
    )
    query = apply_record_scope_filter(query, db, session, Record)
    if status_filter:
        if status_filter == "not_indexed":
            query = query.filter(or_(AiContextDocument.id.is_(None), AiContextDocument.status == "not_indexed"))
        else:
            query = query.filter(AiContextDocument.status == status_filter)

    total = query.with_entities(func.count(func.distinct(Record.id))).scalar() or 0
    rows = (
        query.order_by(Record.document_date.desc(), Record.created_at.desc())
        .offset(max(0, skip))
        .limit(max(1, min(limit, 200)))
        .all()
    )
    return {
        "items": [_sync_minute_item(record, version, client, project, document) for record, version, client, project, document in rows],
        "total": int(total),
        "skip": skip,
        "limit": limit,
    }


async def retry_failed_context_index_jobs(db: Session, *, requested_by: str | None) -> dict[str, Any]:
    ensure_context_sync_enabled(db)
    rows = (
        db.query(Record, RecordVersion)
        .join(AiContextDocument, AiContextDocument.source_minute_id == Record.id)
        .join(RecordVersion, RecordVersion.id == AiContextDocument.source_version_id)
        .filter(AiContextDocument.status == "failed")
        .filter(Record.deleted_at.is_(None))
        .filter(RecordVersion.deleted_at.is_(None))
        .all()
    )
    return await _queue_rows(db, rows, requested_by=requested_by, job_type="reindex_minute_context")


async def reindex_context_minute(db: Session, record_id: str, *, requested_by: str | None) -> dict[str, Any]:
    ensure_context_sync_enabled(db)
    row = _final_minute_row(db, record_id)
    if not row:
        raise HTTPException(status_code=404, detail="Minuta final no encontrada.")
    return await _queue_rows(db, [row], requested_by=requested_by, job_type=JOB_REINDEX_MINUTE_CONTEXT)


async def reindex_context_project(db: Session, project_id: str, *, requested_by: str | None) -> dict[str, Any]:
    ensure_context_sync_enabled(db)
    return await _queue_parent_scope_job(
        db,
        job_type=JOB_REINDEX_PROJECT_CONTEXT,
        requested_by=requested_by,
        project_id=project_id,
    )


async def reindex_context_client(db: Session, client_id: str, *, requested_by: str | None) -> dict[str, Any]:
    ensure_context_sync_enabled(db)
    return await _queue_parent_scope_job(
        db,
        job_type=JOB_REINDEX_CLIENT_CONTEXT,
        requested_by=requested_by,
        client_id=client_id,
    )


async def reindex_all_context(db: Session, *, requested_by: str | None) -> dict[str, Any]:
    ensure_context_sync_enabled(db)
    return await _queue_parent_scope_job(db, job_type=JOB_REINDEX_ALL_CONTEXT, requested_by=requested_by)


async def cleanup_context_minute(db: Session, record_id: str, *, requested_by: str | None) -> dict[str, Any]:
    ensure_context_sync_enabled(db)
    documents = (
        db.query(AiContextDocument)
        .filter(AiContextDocument.source_system == "minuetaitor")
        .filter(AiContextDocument.source_minute_id == record_id)
        .all()
    )
    if not documents:
        raise HTTPException(status_code=404, detail="No hay documentos de contexto para la minuta indicada.")

    queued = 0
    skipped = 0
    for document in documents:
        active_chunks = (
            db.query(AiContextChunk.qdrant_collection)
            .filter(AiContextChunk.document_id == document.id)
            .filter(AiContextChunk.status == "indexed")
            .distinct()
            .all()
        )
        collections = sorted({str(row[0]) for row in active_chunks if row[0]})
        if not collections:
            now = utc_now_db()
            document.status = "deleted_from_index"
            document.indexed_hash = None
            document.chunk_count = 0
            document.last_error = None
            document.last_checked_at = now
            document.deactivated_at = now
            db.commit()
            skipped += 1
            continue

        existing_active_job = (
            db.query(AiContextIndexJob)
            .filter(AiContextIndexJob.job_type == JOB_CLEANUP_MINUTE_CONTEXT)
            .filter(AiContextIndexJob.source_minute_id == document.source_minute_id)
            .filter(AiContextIndexJob.source_version_id == document.source_version_id)
            .filter(AiContextIndexJob.status.in_(ACTIVE_INDEX_JOB_STATUSES))
            .first()
        )
        if existing_active_job:
            skipped += 1
            continue

        document.status = "deleting"
        document.last_error = None
        document.last_checked_at = utc_now_db()
        job_id = str(uuid.uuid4())
        payload = {
            "type": JOB_CLEANUP_MINUTE_CONTEXT,
            "jobId": job_id,
            "recordId": str(document.source_minute_id),
            "clientId": str(document.source_client_id),
            "projectId": str(document.source_project_id) if document.source_project_id else None,
            "versionId": str(document.source_version_id),
            "versionNum": int(document.source_version_num or 0),
            "documentId": str(document.id),
            "collections": collections,
            "requestedBy": requested_by,
        }
        db.add(
            AiContextIndexJob(
                id=job_id,
                job_id=job_id,
                job_type=JOB_CLEANUP_MINUTE_CONTEXT,
                queue_name=CONTEXT_QUEUE_NAME,
                status="queued",
                source_client_id=document.source_client_id,
                source_project_id=document.source_project_id,
                source_minute_id=document.source_minute_id,
                source_version_id=document.source_version_id,
                requested_by=requested_by,
                payload_json=json.dumps(payload, ensure_ascii=False, sort_keys=True),
                queued_at=utc_now_db(),
            )
        )
        db.commit()
        await minute_queue.enqueue_job(CONTEXT_QUEUE_NAME, payload)
        queued += 1

    return {
        "ok": True,
        "queued": queued,
        "skipped": skipped,
        "message": f"Limpieza por minuta encolada: {queued} documento(s), {skipped} omitido(s).",
    }


async def _queue_parent_scope_job(
    db: Session,
    *,
    job_type: str,
    requested_by: str | None,
    client_id: str | None = None,
    project_id: str | None = None,
) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    payload = {
        "type": job_type,
        "jobId": job_id,
        "clientId": client_id,
        "projectId": project_id,
        "requestedBy": requested_by,
    }
    db.add(
        AiContextIndexJob(
            id=job_id,
            job_id=job_id,
            job_type=job_type,
            queue_name=CONTEXT_QUEUE_NAME,
            status="queued",
            source_client_id=client_id,
            source_project_id=project_id,
            requested_by=requested_by,
            payload_json=json.dumps(payload, ensure_ascii=False, sort_keys=True),
            queued_at=utc_now_db(),
        )
    )
    db.commit()
    await minute_queue.enqueue_job(CONTEXT_QUEUE_NAME, payload)
    return {
        "ok": True,
        "queued": 1,
        "skipped": 0,
        "message": "Job padre de reindexación encolado.",
    }


async def scheduled_context_sync_tick(db: Session) -> dict[str, Any]:
    obj = db.query(AiContextSetting).filter(AiContextSetting.id == 1).first()
    if not obj or not bool(obj.context_ai_enabled and obj.sync_enabled):
        return {"ok": True, "queued": 0, "skipped": 0, "message": "Sincronizacion semantica desactivada."}
    rows = (
        _final_minute_rows(db)
        .outerjoin(
            AiContextDocument,
            (AiContextDocument.source_minute_id == Record.id)
            & (AiContextDocument.source_version_id == RecordVersion.id)
            & (AiContextDocument.source_system == "minuetaitor"),
        )
        .filter(or_(AiContextDocument.id.is_(None), AiContextDocument.status.in_(("not_indexed", "outdated", "failed"))))
        .limit(100)
        .all()
    )
    result = await _queue_rows(db, rows, requested_by=None, job_type=JOB_REINDEX_MINUTE_CONTEXT)
    result["message"] = f"Tick de sincronizacion semantica: {result['queued']} encolado(s), {result['skipped']} omitido(s)."
    return result


async def rebuild_context_collection(db: Session, *, requested_by: str | None) -> dict[str, Any]:
    ensure_context_sync_enabled(db)
    job_id = str(uuid.uuid4())
    payload = {
        "type": "rebuild_qdrant_collection",
        "jobId": job_id,
        "requestedBy": requested_by,
    }
    db.add(
        AiContextIndexJob(
            id=job_id,
            job_id=job_id,
            job_type="rebuild_qdrant_collection",
            queue_name=CONTEXT_QUEUE_NAME,
            status="queued",
            requested_by=requested_by,
            payload_json=json.dumps(payload, ensure_ascii=False, sort_keys=True),
            queued_at=utc_now_db(),
        )
    )
    db.commit()
    await minute_queue.enqueue_job(CONTEXT_QUEUE_NAME, payload)
    return {"ok": True, "queued": 1, "skipped": 0, "message": "Regeneración de colección encolada."}


async def queue_context_status_sync(db: Session, *, requested_by: str | None) -> dict[str, Any]:
    ensure_context_sync_enabled(db)
    job_id = str(uuid.uuid4())
    payload = {
        "type": JOB_SYNC_CONTEXT_STATUS,
        "jobId": job_id,
        "requestedBy": requested_by,
    }
    db.add(
        AiContextIndexJob(
            id=job_id,
            job_id=job_id,
            job_type=JOB_SYNC_CONTEXT_STATUS,
            queue_name=CONTEXT_QUEUE_NAME,
            status="queued",
            requested_by=requested_by,
            payload_json=json.dumps(payload, ensure_ascii=False, sort_keys=True),
            queued_at=utc_now_db(),
        )
    )
    db.commit()
    await minute_queue.enqueue_job(CONTEXT_QUEUE_NAME, payload)
    return {"ok": True, "queued": 1, "skipped": 0, "message": "Reconciliación de estados encolada."}


def is_context_indexing_enabled_for_transaction(db: Session) -> bool:
    obj = db.query(AiContextSetting).filter(AiContextSetting.id == 1).first()
    if not obj:
        return False
    return bool(obj.context_ai_enabled and obj.indexing_enabled)


def prepare_minute_context_index_job(
    db: Session,
    *,
    record: Record,
    version: RecordVersion,
    requested_by: str | None,
) -> dict[str, Any] | None:
    if not is_context_indexing_enabled_for_transaction(db):
        logger.info(
            "[context] Indexacion desactivada; no se encola Knowledge Search | record=%s version=%s",
            record.id,
            version.id,
        )
        return None

    existing_active_job = (
        db.query(AiContextIndexJob)
        .filter(AiContextIndexJob.job_type == JOB_INDEX_MINUTE_CONTEXT)
        .filter(AiContextIndexJob.source_minute_id == record.id)
        .filter(AiContextIndexJob.source_version_id == version.id)
        .filter(AiContextIndexJob.status.in_(ACTIVE_INDEX_JOB_STATUSES))
        .order_by(AiContextIndexJob.queued_at.desc())
        .first()
    )
    if existing_active_job:
        logger.info(
            "[context] Job activo existente; se evita duplicado | record=%s version=%s job=%s",
            record.id,
            version.id,
            existing_active_job.id,
        )
        return None

    document = _get_or_create_context_document(db, record=record, version=version)
    if document.status == "synced" and document.indexed_hash and document.source_hash == document.indexed_hash:
        logger.info(
            "[context] Documento ya sincronizado; no se encola indexacion | record=%s version=%s",
            record.id,
            version.id,
        )
        return None

    document.status = "queued"
    document.last_error = None
    document.last_checked_at = utc_now_db()

    job_id = str(uuid.uuid4())
    payload = {
        "event": EVENT_MINUTE_FINALIZED,
        "type": JOB_INDEX_MINUTE_CONTEXT,
        "jobId": job_id,
        "recordId": str(record.id),
        "clientId": str(record.client_id),
        "projectId": str(record.project_id) if record.project_id else None,
        "versionId": str(version.id),
        "versionNum": int(version.version_num or 0),
        "documentId": str(document.id),
        "requestedBy": requested_by,
        "canonicalEndpoint": f"/internal/v1/context/minutes/{record.id}/canonical",
    }
    index_job = AiContextIndexJob(
        id=job_id,
        job_id=job_id,
        job_type=JOB_INDEX_MINUTE_CONTEXT,
        queue_name=CONTEXT_QUEUE_NAME,
        status="queued",
        source_client_id=record.client_id,
        source_project_id=record.project_id,
        source_minute_id=record.id,
        source_version_id=version.id,
        requested_by=requested_by,
        payload_json=json.dumps(payload, ensure_ascii=False, sort_keys=True),
        queued_at=utc_now_db(),
    )
    db.add(index_job)
    db.flush()

    logger.info(
        "[context] Evento logico %s preparado | record=%s version=%s job=%s",
        EVENT_MINUTE_FINALIZED,
        record.id,
        version.id,
        job_id,
    )
    return payload


async def queue_context_reindex_minute(
    db: Session,
    *,
    record: Record,
    version: RecordVersion,
    requested_by: str | None,
    job_type: str = JOB_REINDEX_MINUTE_CONTEXT,
    parent_job_id: str | None = None,
) -> bool:
    existing_active_job = (
        db.query(AiContextIndexJob)
        .filter(AiContextIndexJob.job_type == job_type)
        .filter(AiContextIndexJob.source_minute_id == record.id)
        .filter(AiContextIndexJob.source_version_id == version.id)
        .filter(AiContextIndexJob.status.in_(ACTIVE_INDEX_JOB_STATUSES))
        .first()
    )
    if existing_active_job:
        return False
    document = _get_or_create_context_document(db, record=record, version=version)
    document.status = "queued"
    document.last_error = None
    document.last_checked_at = utc_now_db()
    job_id = str(uuid.uuid4())
    payload = {
        "event": "context.manual_reindex",
        "type": job_type,
        "jobId": job_id,
        "recordId": str(record.id),
        "clientId": str(record.client_id),
        "projectId": str(record.project_id) if record.project_id else None,
        "versionId": str(version.id),
        "versionNum": int(version.version_num or 0),
        "documentId": str(document.id),
        "parentJobId": parent_job_id,
        "requestedBy": requested_by,
        "canonicalEndpoint": f"/internal/v1/context/minutes/{record.id}/canonical",
    }
    db.add(
        AiContextIndexJob(
            id=job_id,
            job_id=job_id,
            job_type=job_type,
            queue_name=CONTEXT_QUEUE_NAME,
            status="queued",
            source_client_id=record.client_id,
            source_project_id=record.project_id,
            source_minute_id=record.id,
            source_version_id=version.id,
            parent_job_id=parent_job_id,
            requested_by=requested_by,
            payload_json=json.dumps(payload, ensure_ascii=False, sort_keys=True),
            queued_at=utc_now_db(),
        )
    )
    db.commit()
    await minute_queue.enqueue_job(CONTEXT_QUEUE_NAME, payload)
    return True


async def enqueue_prepared_context_index_job(payload: dict[str, Any]) -> None:
    await minute_queue.enqueue_job(CONTEXT_QUEUE_NAME, payload)
    logger.info(
        "[context] Job encolado | queue=%s type=%s job=%s",
        CONTEXT_QUEUE_NAME,
        payload.get("type"),
        payload.get("jobId"),
    )


def mark_context_index_job_enqueue_failed(
    db: Session,
    *,
    payload: dict[str, Any],
    error: Exception,
) -> None:
    job_id = str(payload.get("jobId") or "")
    if not job_id:
        return
    message = str(error)
    job = db.query(AiContextIndexJob).filter(AiContextIndexJob.id == job_id).first()
    if job:
        job.status = "failed"
        job.last_error = message
        job.finished_at = utc_now_db()

    document_id = payload.get("documentId")
    if document_id:
        document = db.query(AiContextDocument).filter(AiContextDocument.id == str(document_id)).first()
        if document:
            document.status = "failed"
            document.last_error = f"No se pudo encolar job de contexto: {message}"
            document.last_checked_at = utc_now_db()
    db.commit()


def mark_context_index_job_running(db: Session, job_id: str) -> dict[str, Any]:
    job = _get_index_job(db, job_id)
    job.status = "running"
    job.attempts = int(job.attempts or 0) + 1
    job.started_at = utc_now_db()
    db.commit()
    document = (
        db.query(AiContextDocument.id)
        .filter(AiContextDocument.source_system == "minuetaitor")
        .filter(AiContextDocument.source_minute_id == job.source_minute_id)
        .filter(AiContextDocument.source_version_id == job.source_version_id)
        .first()
    )
    return {"job_id": job.id, "document_id": document[0] if document else None, "status": job.status}


def complete_context_index_job(
    db: Session,
    *,
    job_id: str,
    body,
) -> dict[str, Any]:
    job = _get_index_job(db, job_id)
    document = (
        db.query(AiContextDocument)
        .filter(AiContextDocument.id == body.document_id)
        .first()
    )
    if not document:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Documento de contexto no encontrado.")

    now = utc_now_db()
    (
        db.query(AiContextChunk)
        .filter(AiContextChunk.document_id == document.id)
        .filter(AiContextChunk.status == "indexed")
        .update({"status": "inactive", "deactivated_at": now}, synchronize_session=False)
    )

    for chunk in body.chunks:
        db.merge(
            AiContextChunk(
                id=chunk.id,
                document_id=document.id,
                source_system=document.source_system,
                source_client_id=document.source_client_id,
                source_project_id=document.source_project_id,
                source_minute_id=document.source_minute_id,
                source_version_id=document.source_version_id,
                source_item_id=chunk.source_item_id,
                item_type=chunk.item_type,
                chunk_index=chunk.chunk_index,
                chunk_hash=chunk.chunk_hash,
                source_hash=body.source_hash,
                qdrant_collection=body.qdrant_collection,
                qdrant_point_id=chunk.qdrant_point_id,
                embedding_provider_config_id=body.embedding_provider_config_id,
                embedding_binding_id=body.embedding_binding_id,
                embedding_model=body.embedding_model,
                embedding_dimensions=body.embedding_dimensions,
                status="indexed",
                indexed_at=now,
            )
        )

    document.status = "synced"
    document.source_hash = body.source_hash
    document.indexed_hash = body.source_hash
    document.embedding_provider_config_id = body.embedding_provider_config_id
    document.embedding_binding_id = body.embedding_binding_id
    document.embedding_model = body.embedding_model
    document.embedding_dimensions = body.embedding_dimensions
    document.qdrant_collection = body.qdrant_collection
    document.chunk_count = len(body.chunks)
    document.last_error = None
    document.indexed_at = now
    document.last_checked_at = now

    job.status = "succeeded"
    job.finished_at = now
    job.last_error = None
    db.commit()
    _record_context_embedding_usage(db, job=job, document=document, body=body)
    return {"job_id": job.id, "document_id": document.id, "status": job.status}


def complete_context_cleanup_job(
    db: Session,
    *,
    job_id: str,
    body,
) -> dict[str, Any]:
    job = _get_index_job(db, job_id)
    document = None
    if body.document_id:
        document = db.query(AiContextDocument).filter(AiContextDocument.id == body.document_id).first()
    if not document:
        document = (
            db.query(AiContextDocument)
            .filter(AiContextDocument.source_system == "minuetaitor")
            .filter(AiContextDocument.source_minute_id == body.record_id)
            .filter(AiContextDocument.source_version_id == body.version_id)
            .first()
        )
    if not document:
        raise HTTPException(status_code=404, detail="Documento de contexto no encontrado.")

    now = utc_now_db()
    (
        db.query(AiContextChunk)
        .filter(AiContextChunk.document_id == document.id)
        .filter(AiContextChunk.status == "indexed")
        .update({"status": "deleted_from_index", "deactivated_at": now}, synchronize_session=False)
    )

    document.status = "deleted_from_index"
    document.indexed_hash = None
    document.chunk_count = 0
    document.last_error = None
    document.last_checked_at = now
    document.deactivated_at = now

    job.status = "succeeded"
    job.finished_at = now
    job.last_error = None
    db.commit()
    return {"job_id": job.id, "document_id": document.id, "status": job.status}


def _record_context_embedding_usage(
    db: Session,
    *,
    job: AiContextIndexJob,
    document: AiContextDocument,
    body,
) -> None:
    provider = (
        db.query(AiProviderConfig)
        .filter(AiProviderConfig.id == body.embedding_provider_config_id)
        .first()
    )
    latency_ms = None
    if job.started_at and job.finished_at:
        latency_ms = max(0, int((job.finished_at - job.started_at).total_seconds() * 1000))

    record_ai_usage_event(
        db,
        event_type="context_embedding",
        status="success",
        record_id=document.source_minute_id,
        record_version_id=document.source_version_id,
        client_id=document.source_client_id,
        project_id=document.source_project_id,
        requested_by=job.requested_by,
        provider_config_id=body.embedding_provider_config_id,
        provider_type=getattr(provider, "provider_type", None),
        provider_family=None,
        execution_adapter=None,
        provider_name_snapshot=getattr(provider, "name", None),
        model_name=body.embedding_model,
        external_run_id=job.id,
        started_at=job.started_at,
        finished_at=job.finished_at,
        latency_ms=latency_ms,
        input_tokens=body.input_tokens,
        output_tokens=body.output_tokens,
        provider_usage_raw_json=body.provider_usage_raw_json,
        provider_meta_json={
            **(body.provider_meta_json if isinstance(body.provider_meta_json, dict) else {}),
            "job_type": job.job_type,
            "document_id": document.id,
            "chunk_count": len(body.chunks or []),
            "embedding_binding_id": body.embedding_binding_id,
            "embedding_dimensions": body.embedding_dimensions,
            "qdrant_collection": body.qdrant_collection,
        },
        suppress_errors=True,
    )


async def fail_context_index_job(
    db: Session,
    *,
    job_id: str,
    body,
) -> dict[str, Any]:
    job = _get_index_job(db, job_id)
    now = utc_now_db()
    job.status = "retrying" if body.retryable and int(job.attempts or 0) < int(job.max_attempts or 3) else "failed"
    job.last_error = body.error
    job.finished_at = now

    if body.document_id:
        document = db.query(AiContextDocument).filter(AiContextDocument.id == body.document_id).first()
        if document:
            document.status = "failed"
            document.last_error = body.error
            document.last_checked_at = now
    db.commit()
    if job.status == "failed":
        await notify_context_indexing_terminal_failure(db, job_id=job.id, document_id=body.document_id, error=body.error)
    return {"job_id": job.id, "document_id": body.document_id, "status": job.status}


async def expand_context_reindex_job(db: Session, *, job_id: str) -> dict[str, Any]:
    job = _get_index_job(db, job_id)
    if job.job_type not in {JOB_REINDEX_PROJECT_CONTEXT, JOB_REINDEX_CLIENT_CONTEXT, JOB_REINDEX_ALL_CONTEXT}:
        raise HTTPException(status_code=400, detail="El job no corresponde a una reindexación por alcance.")

    now = utc_now_db()
    job.status = "running"
    job.attempts = int(job.attempts or 0) + 1
    job.started_at = now
    job.last_error = None
    db.commit()

    query = _final_minute_rows(db)
    if job.job_type == JOB_REINDEX_PROJECT_CONTEXT:
        if not job.source_project_id:
            raise HTTPException(status_code=400, detail="Job de proyecto sin project_id.")
        query = query.filter(Record.project_id == job.source_project_id)
    elif job.job_type == JOB_REINDEX_CLIENT_CONTEXT:
        if not job.source_client_id:
            raise HTTPException(status_code=400, detail="Job de cliente sin client_id.")
        query = query.filter(Record.client_id == job.source_client_id)

    result = await _queue_rows(
        db,
        query.all(),
        requested_by=job.requested_by,
        job_type=JOB_REINDEX_MINUTE_CONTEXT,
        parent_job_id=job.id,
    )

    job.status = "succeeded"
    job.finished_at = utc_now_db()
    job.last_error = None
    db.commit()
    result["parentJobId"] = job.id
    result["status"] = job.status
    result["message"] = (
        f"Job padre expandido: {result['queued']} minuta(s) encolada(s), "
        f"{result['skipped']} omitida(s)."
    )
    return result


async def sync_context_status(db: Session, *, job_id: str | None = None) -> dict[str, Any]:
    parent_job = _get_index_job(db, job_id) if job_id else None
    now = utc_now_db()
    if parent_job:
        parent_job.status = "running"
        parent_job.attempts = int(parent_job.attempts or 0) + 1
        parent_job.started_at = now
        parent_job.last_error = None
        db.commit()

    stale_cutoff = now - timedelta(hours=2)
    stale_jobs_query = (
        db.query(AiContextIndexJob)
        .filter(AiContextIndexJob.status.in_(("queued", "running", "retrying")))
        .filter(AiContextIndexJob.queued_at < stale_cutoff)
    )
    if job_id:
        stale_jobs_query = stale_jobs_query.filter(AiContextIndexJob.id != job_id)
    stale_jobs = stale_jobs_query.all()
    for stale_job in stale_jobs:
        stale_job.status = "failed"
        stale_job.finished_at = now
        stale_job.last_error = "Job reconciliado como fallido por antigüedad operativa."

    reconciled_documents = 0
    documents = (
        db.query(AiContextDocument)
        .filter(AiContextDocument.status.in_(("queued", "indexing")))
        .all()
    )
    for document in documents:
        active_jobs = (
            db.query(func.count(AiContextIndexJob.id))
            .filter(AiContextIndexJob.source_minute_id == document.source_minute_id)
            .filter(AiContextIndexJob.source_version_id == document.source_version_id)
            .filter(AiContextIndexJob.status.in_(ACTIVE_INDEX_JOB_STATUSES))
            .scalar()
            or 0
        )
        if active_jobs:
            continue
        document.status = "outdated" if document.indexed_hash else "not_indexed"
        document.last_error = "Documento reconciliado: no existen jobs activos asociados."
        document.last_checked_at = now
        reconciled_documents += 1

    outdated_documents = (
        db.query(AiContextDocument)
        .filter(AiContextDocument.status == "synced")
        .filter(AiContextDocument.source_hash.isnot(None))
        .filter(AiContextDocument.indexed_hash.isnot(None))
        .filter(AiContextDocument.source_hash != AiContextDocument.indexed_hash)
        .all()
    )
    for document in outdated_documents:
        document.status = "outdated"
        document.last_checked_at = now
        reconciled_documents += 1

    if parent_job:
        parent_job.status = "succeeded"
        parent_job.finished_at = now
        parent_job.last_error = None

    db.commit()
    return {
        "ok": True,
        "jobId": job_id,
        "staleJobsFailed": len(stale_jobs),
        "documentsReconciled": reconciled_documents,
        "status": parent_job.status if parent_job else "succeeded",
    }


def _get_index_job(db: Session, job_id: str) -> AiContextIndexJob:
    from fastapi import HTTPException

    job = db.query(AiContextIndexJob).filter(AiContextIndexJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job de contexto no encontrado.")
    return job


def _admin_email_recipients(db: Session) -> list[str]:
    rows = (
        db.query(User.email)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .filter(
            func.upper(Role.code) == "ADMIN",
            Role.is_active.is_(True),
            Role.deleted_at.is_(None),
            UserRole.deleted_at.is_(None),
            User.deleted_at.is_(None),
            User.is_active.is_(True),
            User.email.isnot(None),
        )
        .distinct()
        .all()
    )
    recipients: list[str] = []
    seen: set[str] = set()
    for row in rows:
        email = str(getattr(row, "email", "") or "").strip().lower()
        if email and email not in seen:
            seen.add(email)
            recipients.append(email)
    return recipients


def _context_sync_url(db: Session) -> str:
    return build_public_url(db, "/settings/system?tab=knowledge")


def _context_failure_context(db: Session, *, job: AiContextIndexJob, document: AiContextDocument | None, error: str) -> dict[str, Any]:
    record = document.minute if document else job.minute
    client = document.client if document else job.client
    project = document.project if document else job.project
    branding = build_email_branding_bundle(db, client=client, include_organization_logo=True, include_client_logo=False)
    now = utc_now_db()
    return {
        **branding.context,
        "CLIENT_NAME": getattr(client, "name", None) or "-",
        "PROJECT_NAME": getattr(project, "name", None) or "-",
        "MINUTE_TITLE": getattr(record, "title", None) or str(job.source_minute_id or "-"),
        "MINUTE_ID": str(getattr(record, "id", None) or job.source_minute_id or "-"),
        "VERSION_ID": str((document.source_version_id if document else job.source_version_id) or "-"),
        "JOB_ID": str(job.job_id or job.id),
        "JOB_TYPE": str(job.job_type or "-"),
        "ERROR_MESSAGE": str(error or "Error no especificado")[:1200],
        "FAILED_AT": now.strftime("%d/%m/%Y %H:%M"),
        "SYNC_URL": _context_sync_url(db),
        "SUGGESTED_ACTION": "Revisar el detalle del error en Sistema > Consulta contextual > Sincronizacion semantica y reintentar la minuta cuando la causa este corregida.",
        "_inline_assets": branding.inline_assets,
    }


async def notify_context_indexing_terminal_failure(
    db: Session,
    *,
    job_id: str,
    document_id: str | None,
    error: str,
) -> None:
    job = _get_index_job(db, job_id)
    document = None
    if document_id:
        document = db.query(AiContextDocument).filter(AiContextDocument.id == document_id).first()

    recipients = _admin_email_recipients(db)
    context = _context_failure_context(db, job=job, document=document, error=error)
    action_url = _context_sync_url(db)

    try:
        await create_in_app_notification(
            db,
            notification_type="context.indexing.failed",
            title="Error de indexacion contextual",
            message=f"No se pudo indexar la minuta {context['MINUTE_TITLE']}.",
            level="error",
            tags=["context", "indexing", "failed", "context.indexing.failed"],
            role_codes=["ADMIN"],
            scope_type="minute",
            scope_id=context["MINUTE_ID"] if context["MINUTE_ID"] != "-" else None,
            action_url=action_url,
            metadata={
                "jobId": context["JOB_ID"],
                "jobType": context["JOB_TYPE"],
                "documentId": document_id,
                "clientName": context["CLIENT_NAME"],
                "projectName": context["PROJECT_NAME"],
                "error": context["ERROR_MESSAGE"],
            },
        )
    except Exception as exc:
        logger.warning("[context] No se pudo crear notificacion de error terminal | job=%s err=%s", job_id, exc)

    if not recipients:
        logger.info("[context] Email de error terminal omitido; no hay admins con email | job=%s", job_id)
        return

    try:
        await queue_templated_email(
            to=recipients,
            template_id=CONTEXT_FAILURE_TEMPLATE_ID,
            template_context=context,
            inline_assets=context.get("_inline_assets") or [],
            notification_context={
                "notificationType": "context.indexing.failed.email.sent",
                "title": "Email de error contextual encolado",
                "message": f"Se encolo aviso de error contextual para {context['MINUTE_TITLE']}.",
                "level": "error",
                "tags": ["email", "context", "indexing", "failed"],
                "roleCodes": ["ADMIN"],
                "scopeType": "minute",
                "scopeId": context["MINUTE_ID"] if context["MINUTE_ID"] != "-" else None,
                "actionUrl": action_url,
                "metadata": {
                    "templateId": CONTEXT_FAILURE_TEMPLATE_ID,
                    "jobId": context["JOB_ID"],
                    "documentId": document_id,
                    "recipientEmails": recipients,
                },
            },
        )
    except Exception as exc:
        logger.warning("[context] No se pudo encolar email de error terminal | job=%s err=%s", job_id, exc)


def _get_or_create_context_document(
    db: Session,
    *,
    record: Record,
    version: RecordVersion,
) -> AiContextDocument:
    document = (
        db.query(AiContextDocument)
        .filter(AiContextDocument.source_system == "minuetaitor")
        .filter(AiContextDocument.source_minute_id == record.id)
        .filter(AiContextDocument.source_version_id == version.id)
        .first()
    )
    if document:
        return document

    document = AiContextDocument(
        id=str(uuid.uuid4()),
        source_system="minuetaitor",
        source_client_id=record.client_id,
        source_project_id=record.project_id,
        source_minute_id=record.id,
        source_version_id=version.id,
        source_version_num=int(version.version_num or 0),
        status="queued",
        qdrant_collection=getattr(settings, "qdrant_collection", "minuet_context_v1"),
        last_checked_at=utc_now_db(),
    )
    db.add(document)
    db.flush()
    return document


async def _queue_rows(
    db: Session,
    rows: list[tuple[Record, RecordVersion]],
    *,
    requested_by: str | None,
    job_type: str,
    parent_job_id: str | None = None,
) -> dict[str, Any]:
    queued = 0
    skipped = 0
    for record, version in rows:
        if await queue_context_reindex_minute(
            db,
            record=record,
            version=version,
            requested_by=requested_by,
            job_type=job_type,
            parent_job_id=parent_job_id,
        ):
            queued += 1
        else:
            skipped += 1
    return {
        "ok": True,
        "queued": queued,
        "skipped": skipped,
        "message": f"{queued} job(s) encolado(s), {skipped} omitido(s).",
    }


def _sync_minute_item(
    record: Record,
    version: RecordVersion,
    client: Client,
    project: Project | None,
    document: AiContextDocument | None,
) -> dict[str, Any]:
    return {
        "document_id": document.id if document else None,
        "minute_id": record.id,
        "version_id": version.id,
        "version_num": int(version.version_num or 0),
        "client_id": record.client_id,
        "client_name": client.name if client else None,
        "project_id": record.project_id,
        "project_name": project.name if project else None,
        "title": record.title,
        "status": document.status if document else "not_indexed",
        "source_hash": document.source_hash if document else None,
        "indexed_hash": document.indexed_hash if document else None,
        "chunk_count": int(document.chunk_count or 0) if document else 0,
        "last_error": document.last_error if document else None,
        "indexed_at": document.indexed_at.isoformat() if document and document.indexed_at else None,
        "last_checked_at": document.last_checked_at.isoformat() if document and document.last_checked_at else None,
    }


def _record_status_id(db: Session, code: str) -> int:
    status_id = db.query(RecordStatus.id).filter(RecordStatus.code == code).scalar()
    if not status_id:
        raise HTTPException(status_code=500, detail=f"Catálogo record_status inexistente: {code}")
    return int(status_id)


def _version_status_id(db: Session, code: str) -> int:
    status_id = db.query(VersionStatus.id).filter(VersionStatus.code == code).scalar()
    if not status_id:
        raise HTTPException(status_code=500, detail=f"Catálogo version_status inexistente: {code}")
    return int(status_id)


def _final_minute_rows(db: Session):
    return (
        db.query(Record, RecordVersion)
        .join(RecordVersion, RecordVersion.id == Record.active_version_id)
        .filter(Record.deleted_at.is_(None))
        .filter(RecordVersion.deleted_at.is_(None))
        .filter(Record.status_id == _record_status_id(db, "completed"))
        .filter(RecordVersion.status_id == _version_status_id(db, "final"))
    )


def _final_minute_row(db: Session, record_id: str) -> tuple[Record, RecordVersion] | None:
    return _final_minute_rows(db).filter(Record.id == record_id).first()

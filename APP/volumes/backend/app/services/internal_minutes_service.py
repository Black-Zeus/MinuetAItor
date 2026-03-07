# services/internal_minutes_service.py
"""
TX2: lógica de persistencia del resultado OpenAI.

Este servicio es llamado EXCLUSIVAMENTE desde el endpoint interno
POST /internal/v1/minutes/commit, que a su vez solo acepta requests
del worker (verificados por X-Internal-Secret).

Responsabilidades:
  - Crear RecordVersion (snapshot)
  - Crear RecordArtifacts (inputs + llm_output + canonical)
  - Subir JSON de output a MinIO (minuetaitor-json)
  - Actualizar MinuteTransaction (status=completed, tokens, run_id)
  - Actualizar Record (status → ready-for-edit, latest_version_num, active_version_id)
  - Publicar evento SSE via Redis Pub/Sub para notificar al frontend
  - En caso de error: marcar tx y record como fallidos, publicar evento failed
"""
from __future__ import annotations

import hashlib
import io
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.config import settings
from db.minio_client import get_minio_client
from models.artifact_states import ArtifactState
from models.artifact_types import ArtifactType
from models.buckets import Bucket
from models.minute_transaction import MinuteTransaction
from models.objects import Object
from models.record_artifacts import RecordArtifact
from models.record_drafts import RecordDraft
from models.record_statuses import RecordStatus
from models.record_versions import RecordVersion
from models.records import Record
from models.version_statuses import VersionStatus
from schemas.internal_minutes import MinuteCommitRequest, MinuteCommitResponse

logger = logging.getLogger(__name__)

# ── Constantes de catálogo (mismas que minutes_service) ──────────────────────
BUCKET_CODE_JSON      = "json_container"
BUCKET_JSON           = "minuetaitor-json"

ART_INPUT_TRANSCRIPT  = "INPUT_TRANSCRIPT"
ART_INPUT_SUMMARY     = "INPUT_SUMMARY"
ART_LLM_JSON_ORIG     = "LLM_JSON_ORIGINAL"
ART_CANONICAL_JSON    = "CANONICAL_JSON"

ART_STATE_ORIGINAL    = "ORIGINAL"
ART_STATE_READY       = "READY"
ART_STATE_FAILED      = "FAILED"

RECORD_STATUS_READY   = "ready-for-edit"
RECORD_STATUS_LLM_FAILED = "llm-failed"
RECORD_STATUS_PROC_ERROR = "processing-error"
VERSION_STATUS_SNAPSHOT  = "snapshot"

PUBSUB_CHANNEL        = settings.pubsub_minutes_channel if hasattr(settings, "pubsub_minutes_channel") else "events:minutes"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _get_catalog_id(db: Session, model, code: str) -> int:
    """Resuelve el ID de un catálogo por su code. Lanza 500 si no existe."""
    obj = db.query(model).filter_by(code=code).first()
    if not obj:
        raise RuntimeError(
            f"Catálogo '{model.__tablename__}' con code='{code}' no encontrado. "
            "Verifica los seeds."
        )
    return obj.id


def _get_status_id(db: Session, code: str) -> int:
    obj = db.query(RecordStatus).filter_by(code=code).first()
    if not obj:
        raise RuntimeError(f"RecordStatus '{code}' no encontrado en catálogo.")
    return obj.id


# ── TX2 principal ─────────────────────────────────────────────────────────────

async def commit_minute_tx2(
    db: Session,
    body: MinuteCommitRequest,
) -> MinuteCommitResponse:
    """
    Ejecuta TX2 completa en el contexto del backend.

    Toda la lógica de negocio vive aquí — el worker solo envía el resultado crudo
    de OpenAI y los metadatos necesarios para la persistencia.
    """
    tx_id  = body.transaction_id
    rec_id = body.record_id
    by_id  = body.requested_by_id

    logger.info("TX2 iniciando | tx=%s record=%s", tx_id, rec_id)

    try:
        version_id = _execute_tx2(db, body)
        await _publish_event(tx_id, rec_id, "completed")
        logger.info("TX2 completada | tx=%s version=%s", tx_id, version_id)
        return MinuteCommitResponse(
            record_id=rec_id,
            version_id=version_id,
            transaction_id=tx_id,
        )

    except Exception as exc:
        error_msg = str(exc)
        logger.error("TX2 fallida | tx=%s error=%s", tx_id, error_msg, exc_info=True)

        # Marcar tx y record como fallidos (best-effort — no debe propagar)
        _mark_failed(db, tx_id, rec_id, error_msg)
        await _publish_event(tx_id, rec_id, "failed", error=error_msg)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "tx2_failed",
                "message": error_msg[:500],
                "transaction_id": tx_id,
            },
        )


def _execute_tx2(db: Session, body: MinuteCommitRequest) -> str:
    """
    Operación síncrona de escritura en DB + MinIO.
    Retorna el version_id creado.
    """
    tx_id   = body.transaction_id
    rec_id  = body.record_id
    by_id   = body.requested_by_id
    ometa   = body.input_objects_meta
    cat     = body.catalog_ids

    minio = get_minio_client()

    # ── Verificar que tx y record existen ────────────────────────────────────
    tx     = db.query(MinuteTransaction).filter_by(id=tx_id).first()
    record = db.query(Record).filter_by(id=rec_id).first()

    if not tx:
        raise RuntimeError(f"MinuteTransaction no encontrada: {tx_id}")
    if not record:
        raise RuntimeError(f"Record no encontrado: {rec_id}")

    # ── Resolver IDs de catálogo ─────────────────────────────────────────────
    bucket_json_id    = cat.get("bucket_json_id")    or _get_catalog_id(db, Bucket,        BUCKET_CODE_JSON)
    art_llm_orig_id   = cat.get("art_llm_orig_id")   or _get_catalog_id(db, ArtifactType,  ART_LLM_JSON_ORIG)
    art_canonical_id  = cat.get("art_canonical_id")  or _get_catalog_id(db, ArtifactType,  ART_CANONICAL_JSON)
    state_original_id = cat.get("state_original_id") or _get_catalog_id(db, ArtifactState, ART_STATE_ORIGINAL)
    state_ready_id    = cat.get("state_ready_id")    or _get_catalog_id(db, ArtifactState, ART_STATE_READY)
    version_status_id = cat.get("version_status_id") or _get_catalog_id(db, VersionStatus, VERSION_STATUS_SNAPSHOT)

    # ── Subir outputs a MinIO ─────────────────────────────────────────────────
    out_bytes = json.dumps(body.ai_output, ensure_ascii=False, indent=2).encode("utf-8")
    out_sha   = _sha256_bytes(out_bytes)

    # LLM output original
    llm_key    = f"{rec_id}/llm_output_v1.json"
    llm_obj_id = str(uuid.uuid4())
    minio.put_object(
        BUCKET_JSON, llm_key,
        io.BytesIO(out_bytes), len(out_bytes),
        "application/json",
    )
    db.add(Object(
        id=llm_obj_id, bucket_id=bucket_json_id, object_key=llm_key,
        content_type="application/json", file_ext="json",
        size_bytes=len(out_bytes), sha256=out_sha, created_by=by_id,
    ))

    # Canonical output (mismo contenido en v1, editado en versiones posteriores)
    can_key    = f"{rec_id}/schema_output_v1.json"
    can_obj_id = str(uuid.uuid4())
    minio.put_object(
        BUCKET_JSON, can_key,
        io.BytesIO(out_bytes), len(out_bytes),
        "application/json",
    )
    db.add(Object(
        id=can_obj_id, bucket_id=bucket_json_id, object_key=can_key,
        content_type="application/json", file_ext="json",
        size_bytes=len(out_bytes), sha256=out_sha, created_by=by_id,
    ))

    # ── Crear RecordVersion ───────────────────────────────────────────────────
    ver_id  = str(uuid.uuid4())
    version = RecordVersion(
        id=ver_id,
        record_id=rec_id,
        version_num=1,
        status_id=version_status_id,
        published_by=by_id,
        schema_version="1.0",
        template_version="1.0",
        ai_model=settings.openai_model,
        ai_run_id=body.openai_run_id,
    )
    db.add(version)

    # ── Crear RecordDraft ─────────────────────────────────────────────────────
    db.add(RecordDraft(record_id=rec_id, created_by=by_id))

    # ── flush para obtener ver_id antes de FKs ───────────────────────────────
    db.flush()

    # ── Asociar versión a la transacción ─────────────────────────────────────
    tx.record_version_id = ver_id

    # ── RecordArtifacts de INPUT ──────────────────────────────────────────────
    for m in ometa:
        db.add(RecordArtifact(
            record_id=rec_id,
            record_version_id=ver_id,
            is_draft=False,
            artifact_type_id=m["art_type_id"],
            artifact_state_id=state_original_id,
            object_id=m["obj_id"],
            natural_name=m.get("fname"),
            created_by=by_id,
        ))

    # ── RecordArtifacts de OUTPUT ─────────────────────────────────────────────
    db.add(RecordArtifact(
        record_id=rec_id,
        record_version_id=ver_id,
        is_draft=False,
        artifact_type_id=art_llm_orig_id,
        artifact_state_id=state_original_id,
        object_id=llm_obj_id,
        natural_name="llm_output_v1.json",
        created_by=by_id,
    ))
    db.add(RecordArtifact(
        record_id=rec_id,
        record_version_id=None,   # draft → sin versión publicada aún
        is_draft=True,
        artifact_type_id=art_canonical_id,
        artifact_state_id=state_ready_id,
        object_id=can_obj_id,
        natural_name="schema_output_v1.json",
        created_by=by_id,
    ))

    # ── Actualizar MinuteTransaction ──────────────────────────────────────────
    tx.status        = "completed"
    tx.completed_at  = _now_utc()
    tx.output_object_id = can_obj_id
    tx.openai_run_id    = body.openai_run_id
    tx.openai_model     = settings.openai_model
    tx.tokens_input     = body.tokens_input
    tx.tokens_output    = body.tokens_output

    # ── Actualizar Record ─────────────────────────────────────────────────────
    ready_status_id           = _get_status_id(db, RECORD_STATUS_READY)
    record.status_id          = ready_status_id
    record.active_version_id  = ver_id
    record.latest_version_num = 1
    record.updated_by         = by_id

    db.commit()
    logger.info("TX2 DB commit OK | tx=%s version=%s", tx_id, ver_id)
    return ver_id


def _mark_failed(db: Session, tx_id: str, rec_id: str, error_msg: str) -> None:
    """
    Marca tx y record como fallidos. Best-effort — nunca propaga excepciones.
    Abre una sesión nueva para no depender del estado de la sesión principal.
    """
    try:
        db.rollback()
        tx     = db.query(MinuteTransaction).filter_by(id=tx_id).first()
        record = db.query(Record).filter_by(id=rec_id).first()

        if tx:
            tx.status        = "failed"
            tx.error_message = error_msg[:1000]
            tx.completed_at  = _now_utc()

        if record:
            llm_failed_id    = _get_status_id(db, RECORD_STATUS_LLM_FAILED)
            record.status_id = llm_failed_id
            record.updated_by = tx.requested_by if tx else None

        db.commit()
        logger.info("Estado failed marcado | tx=%s record=%s", tx_id, rec_id)

    except Exception as e:
        logger.error("Error marcando failed (ignorado) | tx=%s: %s", tx_id, e)


async def _publish_event(
    tx_id: str,
    rec_id: str,
    event: str,
    error: str | None = None,
) -> None:
    """Publica en Redis Pub/Sub para que el SSE del backend notifique al frontend."""
    try:
        from db.redis import get_redis
        redis = await get_redis()
        payload = {
            "event":          event,
            "transaction_id": tx_id,
            "record_id":      rec_id,
        }
        if error:
            payload["error"] = error[:500]
        await redis.publish(PUBSUB_CHANNEL, json.dumps(payload))
        logger.info("Evento SSE publicado | event=%s tx=%s", event, tx_id)
    except Exception as e:
        logger.error("Error publicando evento SSE (ignorado) | tx=%s: %s", tx_id, e)
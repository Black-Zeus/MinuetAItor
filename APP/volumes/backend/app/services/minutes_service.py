# services/minutes_service.py
"""
Servicio de generación de minutas.

Flujo:
  1. Validar y parsear el JSON de entrada
  2. Generar UUIDs para record + transaction
  3. Subir archivos a MinIO  → inputs_container/{record_id}/
  4. Registrar objects en BD
  5. Crear record (status ACCEPTED) + minute_transaction (pending)
  6. Subir archivos a OpenAI Files API
  7. Llamar a la IA (Responses API con archivos)
  8. Guardar output_json en MinIO  → json_container/{record_id}/
  9. Registrar output object + record_artifacts + record_version
  10. Actualizar minute_transaction → completed
  11. Retornar MinuteStatusResponse

El endpoint es SÍNCRONO en esta primera versión.
TODO: mover a tarea Celery/ARQ cuando el tiempo de procesamiento lo justifique.
"""
from __future__ import annotations

import hashlib
import io
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import UploadFile
from sqlalchemy.orm import Session

from core.config import settings
from db.minio_client import get_minio_client
from models.minute_transaction import MinuteTransaction
from models.objects import Object
from models.record_artifacts import RecordArtifact
from models.record_versions import RecordVersion
from models.records import Record
from schemas.minutes import MinuteGenerateRequest, MinuteGenerateResponse, MinuteStatusResponse

logger = logging.getLogger(__name__)

# ─── Constantes de catálogo (deben coincidir con seeds) ──────────────────────

BUCKET_INPUTS    = "inputs_container"
BUCKET_JSON      = "json_container"
BUCKET_PUBLISHED = "published_container"

ART_INPUT_TRANSCRIPT = "INPUT_TRANSCRIPT"
ART_INPUT_SUMMARY    = "INPUT_SUMMARY"
ART_LLM_JSON_ORIG    = "LLM_JSON_ORIGINAL"
ART_CANONICAL_JSON   = "CANONICAL_JSON"

ART_STATE_ORIGINAL  = "ORIGINAL"
ART_STATE_GENERATING = "GENERATING"
ART_STATE_READY     = "READY"
ART_STATE_FAILED    = "FAILED"

RECORD_TYPE_MINUTE  = "MINUTE"
RECORD_STATUS_ACCEPTED = "ACCEPTED"
VERSION_STATUS_PUBLISHED = "PUBLISHED"

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _get_catalog_id(db: Session, model_class, code: str) -> int:
    """Resuelve el ID de un catálogo por su code. Falla rápido si no existe."""
    obj = db.query(model_class).filter_by(code=code).first()
    if obj is None:
        raise RuntimeError(f"Catálogo {model_class.__tablename__} code='{code}' no encontrado en BD")
    return obj.id


def _build_ai_input_schema(
    request: MinuteGenerateRequest,
    transaction_id: str,
    file_metadata: list[dict],
) -> dict:
    """
    Construye el objeto que cumple AI_input_Schema.json
    para enviarlo al agente OpenAI.
    """
    mi = request.meeting_info
    pi = request.project_info
    pa = request.participants
    pr = request.profile_info

    schema: dict = {
        "transactionId": transaction_id,
        "attachments": file_metadata,
        "meetingInfo": {
            "scheduledDate":      mi.scheduled_date,
            "scheduledStartTime": mi.scheduled_start_time,
            "scheduledEndTime":   mi.scheduled_end_time,
        },
        "projectInfo": {
            "client":  pi.client,
            "project": pi.project,
        },
        "participants": {
            "attendees": pa.attendees,
        },
        "profileInfo": {
            "profileId":   pr.profile_id,
            "profileName": pr.profile_name,
        },
        "preparedBy": request.prepared_by,
    }

    # Opcionales
    if mi.actual_start_time:
        schema["meetingInfo"]["actualStartTime"] = mi.actual_start_time
    if mi.actual_end_time:
        schema["meetingInfo"]["actualEndTime"] = mi.actual_end_time
    if mi.location:
        schema["meetingInfo"]["location"] = mi.location
    if mi.title:
        schema["meetingInfo"]["title"] = mi.title
    if pi.category:
        schema["projectInfo"]["category"] = pi.category
    if pa.invited:
        schema["participants"]["invited"] = pa.invited
    if pa.copy_recipients:
        schema["participants"]["copyRecipients"] = pa.copy_recipients
    if request.additional_notes:
        schema["additionalNotes"] = request.additional_notes
    if request.generation_options:
        schema["generationOptions"] = {"language": request.generation_options.language}

    return schema


# ─── Función principal ────────────────────────────────────────────────────────

async def generate_minute(
    db: Session,
    request: MinuteGenerateRequest,
    files: list[UploadFile],
    requested_by_id: str,
) -> MinuteGenerateResponse:
    """
    Orquesta la creación completa de una minuta.
    Retorna 202 con transaction_id + record_id.
    """
    # Importaciones diferidas para evitar importar modelos de catálogo en el módulo
    from models.artifact_states import ArtifactState
    from models.artifact_types import ArtifactType
    from models.buckets import Bucket
    from models.record_statuses import RecordStatus
    from models.record_types import RecordType
    from models.version_statuses import VersionStatus

    transaction_id = str(uuid.uuid4())
    record_id      = str(uuid.uuid4())

    logger.info(f"[minutes] Iniciando generación | record={record_id} tx={transaction_id}")

    # ── Resolver IDs de catálogo ──────────────────────────────────────────────
    record_type_id     = _get_catalog_id(db, RecordType,     RECORD_TYPE_MINUTE)
    record_status_id   = _get_catalog_id(db, RecordStatus,   RECORD_STATUS_ACCEPTED)
    version_status_id  = _get_catalog_id(db, VersionStatus,  VERSION_STATUS_PUBLISHED)
    bucket_inputs_id   = _get_catalog_id(db, Bucket,         BUCKET_INPUTS)
    bucket_json_id     = _get_catalog_id(db, Bucket,         BUCKET_JSON)
    art_transcript_id  = _get_catalog_id(db, ArtifactType,   ART_INPUT_TRANSCRIPT)
    art_summary_id     = _get_catalog_id(db, ArtifactType,   ART_INPUT_SUMMARY)
    art_llm_orig_id    = _get_catalog_id(db, ArtifactType,   ART_LLM_JSON_ORIG)
    art_canonical_id   = _get_catalog_id(db, ArtifactType,   ART_CANONICAL_JSON)
    state_original_id  = _get_catalog_id(db, ArtifactState,  ART_STATE_ORIGINAL)
    state_ready_id     = _get_catalog_id(db, ArtifactState,  ART_STATE_READY)
    state_failed_id    = _get_catalog_id(db, ArtifactState,  ART_STATE_FAILED)

    minio = get_minio_client()

    # ── 1. Crear record y transaction en BD ───────────────────────────────────
    now = _now_utc()

    record = Record(
        id               = record_id,
        record_type_id   = record_type_id,
        record_status_id = record_status_id,
        is_active        = True,
        created_by       = requested_by_id,
        created_at       = now,
    )
    db.add(record)

    tx = MinuteTransaction(
        id           = transaction_id,
        record_id    = record_id,
        status       = "pending",
        requested_by = requested_by_id,
        created_at   = now,
    )
    db.add(tx)
    db.flush()  # para que el record_id esté disponible en FKs

    # ── 2. Leer archivos y subir a MinIO ──────────────────────────────────────
    file_metadata: list[dict] = []   # para el schema de la IA
    input_object_id: Optional[str] = None

    for upload in files:
        raw = await upload.read()
        sha = _sha256_bytes(raw)
        fname = upload.filename or "archivo.txt"
        mime  = upload.content_type or "text/plain"
        ext   = fname.rsplit(".", 1)[-1].lower() if "." in fname else "txt"

        # Determinar tipo de artefacto según nombre del archivo
        if "resumen" in fname.lower() or "summary" in fname.lower():
            art_type_id = art_summary_id
            file_type   = "summary"
        else:
            art_type_id = art_transcript_id
            file_type   = "transcription"

        obj_key  = f"{record_id}/{fname}"
        obj_id   = str(uuid.uuid4())

        # Subir a MinIO
        minio.put_object(
            bucket_name  = BUCKET_INPUTS,
            object_name  = obj_key,
            data         = io.BytesIO(raw),
            length       = len(raw),
            content_type = mime,
        )
        logger.info(f"[minutes] Subido a MinIO: {BUCKET_INPUTS}/{obj_key}")

        # Registrar object en BD
        obj = Object(
            id         = obj_id,
            bucket_id  = bucket_inputs_id,
            object_key = obj_key,
            file_name  = fname,
            mime_type  = mime,
            file_size  = len(raw),
            sha256     = sha,
            created_by = requested_by_id,
            created_at = now,
        )
        db.add(obj)

        # Registrar record_artifact
        art = RecordArtifact(
            id               = str(uuid.uuid4()),
            record_id        = record_id,
            artifact_type_id = art_type_id,
            artifact_state_id= state_original_id,
            object_id        = obj_id,
            is_draft         = False,
            created_by       = requested_by_id,
            created_at       = now,
        )
        db.add(art)

        # Metadata para el schema de IA
        file_metadata.append({
            "fileName": fname,
            "mimeType": mime,
            "sha256":   sha,
            "fileType": file_type,
        })

        # Guardar el primer input object_id en la transaction
        if input_object_id is None:
            input_object_id = obj_id

    # Actualizar la tx con el input_object_id y estado processing
    tx.status          = "processing"
    tx.input_object_id = input_object_id
    tx.updated_at      = _now_utc()

    db.flush()

    # ── 3. Construir input schema para la IA ──────────────────────────────────
    ai_input = _build_ai_input_schema(request, transaction_id, file_metadata)

    # Guardar input JSON en MinIO
    ai_input_bytes = json.dumps(ai_input, ensure_ascii=False, indent=2).encode("utf-8")
    ai_input_key   = f"{record_id}/schema_input_original.json"
    ai_input_obj_id = str(uuid.uuid4())

    minio.put_object(
        bucket_name  = BUCKET_JSON,
        object_name  = ai_input_key,
        data         = io.BytesIO(ai_input_bytes),
        length       = len(ai_input_bytes),
        content_type = "application/json",
    )

    ai_input_obj = Object(
        id         = ai_input_obj_id,
        bucket_id  = bucket_json_id,
        object_key = ai_input_key,
        file_name  = "schema_input_original.json",
        mime_type  = "application/json",
        file_size  = len(ai_input_bytes),
        sha256     = _sha256_bytes(ai_input_bytes),
        created_by = requested_by_id,
        created_at = _now_utc(),
    )
    db.add(ai_input_obj)
    tx.input_object_id = ai_input_obj_id

    # ── 4. Llamar a OpenAI ────────────────────────────────────────────────────
    try:
        ai_output = await _call_openai(ai_input, files, request.profile_info)
    except Exception as exc:
        logger.error(f"[minutes] Error en OpenAI: {exc}", exc_info=True)
        tx.status        = "failed"
        tx.error_message = str(exc)
        tx.updated_at    = _now_utc()
        db.commit()
        raise

    # ── 5. Guardar output JSON en MinIO ───────────────────────────────────────
    ai_output_bytes   = json.dumps(ai_output, ensure_ascii=False, indent=2).encode("utf-8")
    ai_output_key     = f"{record_id}/schema_output_original.json"
    ai_output_obj_id  = str(uuid.uuid4())

    minio.put_object(
        bucket_name  = BUCKET_JSON,
        object_name  = ai_output_key,
        data         = io.BytesIO(ai_output_bytes),
        length       = len(ai_output_bytes),
        content_type = "application/json",
    )

    ai_output_obj = Object(
        id         = ai_output_obj_id,
        bucket_id  = bucket_json_id,
        object_key = ai_output_key,
        file_name  = "schema_output_original.json",
        mime_type  = "application/json",
        file_size  = len(ai_output_bytes),
        sha256     = _sha256_bytes(ai_output_bytes),
        created_by = requested_by_id,
        created_at = _now_utc(),
    )
    db.add(ai_output_obj)

    # ── 6. Registrar artefactos de salida ────────────────────────────────────
    # LLM_JSON_ORIGINAL (inmutable)
    db.add(RecordArtifact(
        id               = str(uuid.uuid4()),
        record_id        = record_id,
        artifact_type_id = art_llm_orig_id,
        artifact_state_id= state_original_id,
        object_id        = ai_output_obj_id,
        is_draft         = False,
        created_by       = requested_by_id,
        created_at       = _now_utc(),
    ))

    # CANONICAL_JSON (editable por usuario — inicialmente igual al output)
    canonical_key    = f"{record_id}/schema_output_v1.json"
    canonical_obj_id = str(uuid.uuid4())

    minio.put_object(
        bucket_name  = BUCKET_JSON,
        object_name  = canonical_key,
        data         = io.BytesIO(ai_output_bytes),
        length       = len(ai_output_bytes),
        content_type = "application/json",
    )

    canonical_obj = Object(
        id         = canonical_obj_id,
        bucket_id  = bucket_json_id,
        object_key = canonical_key,
        file_name  = "schema_output_v1.json",
        mime_type  = "application/json",
        file_size  = len(ai_output_bytes),
        sha256     = _sha256_bytes(ai_output_bytes),
        created_by = requested_by_id,
        created_at = _now_utc(),
    )
    db.add(canonical_obj)

    db.add(RecordArtifact(
        id               = str(uuid.uuid4()),
        record_id        = record_id,
        artifact_type_id = art_canonical_id,
        artifact_state_id= state_ready_id,
        object_id        = canonical_obj_id,
        is_draft         = True,
        created_by       = requested_by_id,
        created_at       = _now_utc(),
    ))

    # ── 7. Crear record_version v1 ────────────────────────────────────────────
    version_id = str(uuid.uuid4())
    version = RecordVersion(
        id               = version_id,
        record_id        = record_id,
        version_num      = 1,
        version_status_id= version_status_id,
        ai_run_id        = tx.openai_run_id,
        created_by       = requested_by_id,
        created_at       = _now_utc(),
    )
    db.add(version)

    # Actualizar record con la versión activa
    record.active_version_id   = version_id
    record.latest_version_num  = 1
    record.updated_by          = requested_by_id
    record.updated_at          = _now_utc()

    # ── 8. Finalizar transaction ──────────────────────────────────────────────
    tx.status           = "completed"
    tx.output_object_id = ai_output_obj_id
    tx.record_version_id= version_id
    tx.completed_at     = _now_utc()
    tx.updated_at       = _now_utc()

    db.commit()
    logger.info(f"[minutes] Generación completada | record={record_id} tx={transaction_id}")

    return MinuteGenerateResponse(
        transaction_id=transaction_id,
        record_id=record_id,
        status="completed",
        message="Minuta generada correctamente.",
    )


async def get_minute_status(db: Session, transaction_id: str) -> MinuteStatusResponse:
    tx = db.query(MinuteTransaction).filter_by(id=transaction_id).first()
    if tx is None:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction no encontrada")

    def _fmt(dt) -> Optional[str]:
        if dt is None:
            return None
        if hasattr(dt, "isoformat"):
            return dt.isoformat()
        return str(dt)

    return MinuteStatusResponse(
        transaction_id=tx.id,
        record_id=tx.record_id,
        status=tx.status,
        error_message=tx.error_message,
        created_at=_fmt(tx.created_at),
        updated_at=_fmt(tx.updated_at),
        completed_at=_fmt(tx.completed_at),
    )


# ─── Llamada a OpenAI ─────────────────────────────────────────────────────────

async def _call_openai(
    ai_input: dict,
    files: list[UploadFile],
    profile_info,
) -> dict:
    """
    Sube archivos a OpenAI Files API y llama a la Responses API
    con el prompt del perfil de análisis.
    Retorna el output JSON parseado.
    """
    import openai

    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    # 1. Subir archivos a OpenAI
    openai_file_ids: dict[str, str] = {}  # sha256 → file_id

    # Necesitamos releer los archivos (ya fueron leídos antes — buscar en MinIO o releer)
    # Aquí hacemos seek(0) en los UploadFile si es posible, o los excluimos
    for upload in files:
        try:
            await upload.seek(0)
            raw = await upload.read()
        except Exception:
            continue

        sha = _sha256_bytes(raw)
        oai_file = await client.files.create(
            file=(upload.filename, raw, upload.content_type or "text/plain"),
            purpose="assistants",
        )
        openai_file_ids[sha] = oai_file.id
        logger.info(f"[openai] Archivo subido: {upload.filename} → {oai_file.id}")

    # Agregar file_ids al schema
    ai_input_with_ids = {**ai_input}
    for att in ai_input_with_ids.get("attachments", []):
        sha = att.get("sha256", "")
        if sha in openai_file_ids:
            att["openaiFileId"] = openai_file_ids[sha]

    # 2. Cargar prompt base del perfil
    prompt_system = _load_agent_prompt(profile_info.profile_id)

    # 3. Llamar a la Responses API (o Chat Completions como fallback)
    user_content = (
        f"Procesa la siguiente reunión y genera la minuta estructurada según el schema.\n\n"
        f"INPUT:\n{json.dumps(ai_input_with_ids, ensure_ascii=False, indent=2)}"
    )

    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": prompt_system},
            {"role": "user",   "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    raw_text = response.choices[0].message.content or "{}"

    try:
        output = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(f"[openai] Output no es JSON válido: {e}")
        raise RuntimeError(f"La IA retornó un JSON inválido: {e}")

    return output


def _load_agent_prompt(profile_id: str) -> str:
    """
    Intenta cargar el prompt del agente desde el archivo assets/prompts/agent.md.
    Fallback al prompt genérico si no existe.
    """
    import os

    prompt_path = "/app/assets/prompts/agent.md"
    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()

    return (
        "Eres un asistente experto en redacción de minutas de reunión corporativas. "
        "Analiza el contenido proporcionado y genera una minuta estructurada en formato JSON "
        "siguiendo el schema de salida definido. Sé preciso, conciso y objetivo."
    )
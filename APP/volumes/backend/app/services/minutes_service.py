# services/minutes_service.py
"""
Servicio de generación de minutas.

Flujo:
  1. Resolver IDs de catálogo desde BD
  2. Crear Record (status_id=ACCEPTED) + MinuteTransaction (pending)
  3. Leer archivos y subir a MinIO → minuetaitor-inputs/{record_id}/
  4. Registrar Objects + RecordArtifacts de entrada en BD
  5. Construir AI input schema
  6. Llamar a OpenAI (sube archivos + chat completions)
  7. Guardar output JSON en MinIO → minuetaitor-json/{record_id}/
  8. Registrar Objects + RecordArtifacts de salida en BD
  9. Crear RecordVersion v1
  10. Actualizar Record (active_version_id) + MinuteTransaction (completed)
  11. Retornar MinuteGenerateResponse

SÍNCRONO en v1.
TODO: mover a tarea async (Celery/ARQ) cuando el tiempo de procesamiento lo justifique.
"""
from __future__ import annotations

import os

import hashlib
import io
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import openai  # ← AGREGAR ESTA LÍNEA

from fastapi import UploadFile, HTTPException, status  # ← AGREGAR HTTPException y status AQUÍ
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from core.config import settings
from db.minio_client import get_minio_client
from models.minute_transaction import MinuteTransaction
from models.objects import Object
from models.record_artifacts import RecordArtifact
from models.record_versions import RecordVersion
from models.records import Record
from schemas.minutes import MinuteGenerateRequest, MinuteGenerateResponse, MinuteStatusResponse

logger = logging.getLogger(__name__)

# ─── Constantes de catálogo ───────────────────────────────────────────────────
# BUCKET_CODE_* → field 'code' en tabla buckets (para resolver bucket_id via _get_catalog_id)
# BUCKET_*      → nombres reales de buckets en MinIO (para put_object / get_object)

BUCKET_CODE_INPUTS    = "inputs_container"
BUCKET_CODE_JSON      = "json_container"
BUCKET_CODE_PUBLISHED = "published_container"

BUCKET_INPUTS    = "minuetaitor-inputs"
BUCKET_JSON      = "minuetaitor-json"
BUCKET_PUBLISHED = "minuetaitor-published"

ART_INPUT_TRANSCRIPT = "INPUT_TRANSCRIPT"
ART_INPUT_SUMMARY    = "INPUT_SUMMARY"
ART_LLM_JSON_ORIG    = "LLM_JSON_ORIGINAL"
ART_CANONICAL_JSON   = "CANONICAL_JSON"

ART_STATE_ORIGINAL = "ORIGINAL"
ART_STATE_READY    = "READY"
ART_STATE_FAILED   = "FAILED"

RECORD_TYPE_MINUTE       = "MINUTE"
RECORD_STATUS_ACCEPTED   = "ACCEPTED"
VERSION_STATUS_PUBLISHED = "PUBLISHED"


# ─── Helpers internos ────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _ext_from_filename(fname: str) -> str:
    """Extrae extensión sin punto. 'archivo.txt' → 'txt'."""
    if "." in fname:
        return fname.rsplit(".", 1)[-1].lower()
    return "bin"


# Mapa de normalización de content_type al valor EXACTO en mime_types (seeds).
# El trigger trg_objects_sync_mime_ext_ins hace match exacto por texto.
_MIME_NORMALIZE: dict[str, str] = {
    "text/plain":                    "text/plain; charset=utf-8",
    "text/plain; charset=utf8":      "text/plain; charset=utf-8",
    "text/plain;charset=utf-8":      "text/plain; charset=utf-8",
    "text/plain;charset=utf8":       "text/plain; charset=utf-8",
    "application/json":              "application/json",
    "application/pdf":               "application/pdf",
    "image/png":                     "image/png",
    "image/jpeg":                    "image/jpeg",
    "image/jpg":                     "image/jpeg",
}


def _normalize_mime(mime: str) -> str:
    """
    Normaliza el content_type al valor exacto registrado en mime_types.
    El trigger de BD hace búsqueda exacta — si no coincide falla con SIGNAL.
    """
    normalized = _MIME_NORMALIZE.get(mime.strip().lower())
    if normalized:
        return normalized
    logger.warning(f"[minutes] MIME no normalizado: '{mime}' — puede fallar en BD")
    return mime


def _get_catalog_id(db: Session, model_class, code: str):
    """
    Resuelve el ID de un catálogo por su campo 'code'.
    Falla rápido (fail-fast) si no existe.
    """
    obj = db.query(model_class).filter_by(code=code).first()
    if obj is None:
        raise RuntimeError(
            f"Catálogo '{model_class.__tablename__}' con code='{code}' "
            f"no encontrado en BD. Verifica los seeds."
        )
    return obj.id


def _parse_date(value: Optional[str]):
    """Parsea 'YYYY-MM-DD' a date. Retorna None si falla."""
    if not value:
        return None
    try:
        from datetime import date
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _parse_time(value: Optional[str]):
    """Parsea 'HH:MM' o 'HH:MM:SS' a time. Retorna None si falla."""
    if not value:
        return None
    try:
        from datetime import time
        parts = value.split(":")
        if len(parts) >= 2:
            return time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
    except (ValueError, TypeError, IndexError):
        pass
    return None


def _get_placeholder_client_id(db: Session) -> str:
    """
    Obtiene el ID del primer cliente activo como placeholder.
    TODO: hacer client_id obligatorio en MinuteProjectInfo cuando el
          frontend envíe UUIDs reales en vez de nombres de texto.
    """
    from models.clients import Client
    client = db.query(Client).filter_by(is_active=True).first()
    if client is None:
        raise RuntimeError(
            "No existe ningún cliente activo en BD. "
            "Crea un cliente antes de generar minutas."
        )
    return str(client.id)


def _get_ai_profile_data(db: Session, profile_id: str) -> dict:
    """
    Carga los datos completos del perfil AI desde la BD.
    Necesario para inyectar description y prompt en el template agent.md.
    """
    try:
        from models.ai_profiles import AiProfile
        profile = (
            db.query(AiProfile)
            .filter(AiProfile.id == profile_id, AiProfile.deleted_at.is_(None))
            .first()
        )
        if profile:
            return {
                "profile_id":          str(profile.id),
                "profile_name":        profile.name or "",
                "profile_description": profile.description or "Sin descripción",
                "profile_prompt":      profile.prompt or "",
            }
    except Exception as e:
        logger.warning(f"[minutes] No se pudo cargar perfil AI '{profile_id}': {e}")

    # Fallback para no bloquear el flujo
    return {
        "profile_id":          profile_id,
        "profile_name":        "Perfil genérico",
        "profile_description": "Perfil de análisis general",
        "profile_prompt":      "",
    }


def _build_object_row(
    obj_id:       str,
    bucket_id:    int,
    object_key:   str,
    content_type: str,
    file_ext:     str,
    size_bytes:   int,
    sha256:       str,
    created_by:   str,
) -> Object:
    """Construye un Object ORM usando los campos exactos del modelo."""
    return Object(
        id           = obj_id,
        bucket_id    = bucket_id,
        object_key   = object_key,
        content_type = content_type,
        file_ext     = file_ext,
        size_bytes   = size_bytes,
        sha256       = sha256,
        created_by   = created_by,
    )


def _build_artifact_row(
    record_id:         str,
    artifact_type_id:  int,
    artifact_state_id: int,
    object_id:         str,
    created_by:        str,
    record_version_id: Optional[str] = None,  # ← NUEVO: parámetro opcional
    is_draft:          bool = False,
    natural_name:      Optional[str] = None,
) -> RecordArtifact:
    """Construye un RecordArtifact ORM usando los campos exactos del modelo."""
    return RecordArtifact(
        record_id         = record_id,
        artifact_type_id  = artifact_type_id,
        artifact_state_id = artifact_state_id,
        object_id         = object_id,
        record_version_id = record_version_id,  # ← NUEVO: asignar el valor
        is_draft          = is_draft,
        natural_name      = natural_name,
        created_by        = created_by,
    )


def _build_ai_input_schema(
    request:       MinuteGenerateRequest,
    transaction_id: str,
    file_metadata:  list[dict],
) -> dict:
    """Construye el payload JSON de entrada para el agente OpenAI."""
    mi = request.meeting_info
    pi = request.project_info
    pa = request.participants
    pr = request.profile_info

    schema: dict = {
        "transactionId": transaction_id,
        "attachments":   file_metadata,
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

    # Campos opcionales
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


def _reload_files_from_minio(
    minio,
    bucket:        str,
    record_id:     str,
    file_metadata: list[dict],
) -> list[tuple[str, bytes, str]]:
    """
    Recarga archivos desde MinIO (después de que los UploadFile ya fueron consumidos).
    Retorna lista de (filename, raw_bytes, mime_type).
    """
    result = []
    for meta in file_metadata:
        fname   = meta["fileName"]
        mime    = meta["mimeType"]
        obj_key = f"{record_id}/{fname}"
        try:
            response = minio.get_object(bucket, obj_key)
            raw = response.read()
            response.close()
            response.release_conn()
            result.append((fname, raw, mime))
            logger.debug(f"[minutes] Recargado desde MinIO: {obj_key} ({len(raw)} bytes)")
        except Exception as e:
            logger.warning(f"[minutes] No se pudo recargar {obj_key} desde MinIO: {e}")
    return result


def _load_agent_prompt(
    profile_id:          str,
    profile_name:        str,
    profile_description: str,
    profile_prompt:      str,
    additional_notes:    str = "",
    user_tags:           str = "",
) -> str:
    """
    Carga agent.md e inyecta los valores del perfil reemplazando placeholders.
    Usa un prompt genérico como fallback si el archivo no existe.
    """
    import os
    prompt_path = "/app/assets/prompts/agent.md"

    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            template = f.read()

        prompt = template
        prompt = prompt.replace("{profile_id}",          profile_id)
        prompt = prompt.replace("{profile_name}",        profile_name)
        prompt = prompt.replace("{profile_description}", profile_description)
        prompt = prompt.replace("{profile_prompt}",      profile_prompt or "Analiza la reunión de forma general y objetiva.")
        prompt = prompt.replace("{additional_notes}",    additional_notes or "Sin notas adicionales.")
        prompt = prompt.replace("{user_tags}",           user_tags or "Sin tags proporcionados.")

        logger.debug(f"[minutes] Prompt cargado desde agent.md | perfil='{profile_name}'")
        return prompt

    logger.warning(f"[minutes] agent.md no encontrado en {prompt_path} — usando prompt fallback")
    return (
        f"Eres un asistente experto en redacción de minutas de reunión corporativas.\n\n"
        f"PERFIL DE ANÁLISIS:\n"
        f"- ID: {profile_id}\n"
        f"- Nombre: {profile_name}\n"
        f"- Descripción: {profile_description}\n"
        f"- Instrucciones específicas: {profile_prompt or 'Analiza la reunión de forma general y objetiva.'}\n\n"
        f"Genera la minuta en formato JSON estructurado. Sé preciso, objetivo y formal.\n\n"
        f"Notas adicionales del usuario: {additional_notes or 'Sin notas adicionales.'}"
    )


async def _call_openai(
    ai_input:         dict,
    files_bytes:      list[tuple[str, bytes, str]],
    profile_data:     dict,
    additional_notes: str = "",
) -> dict:
    """
    Sube archivos a OpenAI Files API y llama a Chat Completions
    con el prompt del perfil parametrizado.
    Retorna el output JSON parseado.
    """
    import openai

    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    # 1. Subir archivos a OpenAI
    openai_file_ids: dict[str, str] = {}  # sha256 → file_id

    for fname, raw, mime in files_bytes:
        sha = _sha256_bytes(raw)
        try:
            oai_file = await client.files.create(
                file    = (fname, raw, mime or "text/plain"),
                purpose = "assistants",
            )
            openai_file_ids[sha] = oai_file.id
            logger.info(f"[openai] Archivo subido: {fname} → {oai_file.id}")
        except Exception as e:
            logger.warning(f"[openai] Error subiendo {fname}: {e}")

    # Enriquecer el schema con los file_ids obtenidos
    ai_input_enriched = {**ai_input}
    for att in ai_input_enriched.get("attachments", []):
        sha = att.get("sha256", "")
        if sha in openai_file_ids:
            att["openaiFileId"] = openai_file_ids[sha]

    # 2. Cargar y parametrizar el prompt del sistema
    prompt_system = _load_agent_prompt(
        profile_id          = profile_data["profile_id"],
        profile_name        = profile_data["profile_name"],
        profile_description = profile_data["profile_description"],
        profile_prompt      = profile_data["profile_prompt"],
        additional_notes    = additional_notes,
        user_tags           = "",
    )

    # 3. Chat Completions con response_format JSON
    user_content = (
        "Procesa la siguiente reunión y genera la minuta estructurada en JSON.\n\n"
        f"INPUT:\n{json.dumps(ai_input_enriched, ensure_ascii=False, indent=2)}"
    )

    response = await client.chat.completions.create(
        model           = settings.openai_model,
        messages        = [
            {"role": "system", "content": prompt_system},
            {"role": "user",   "content": user_content},
        ],
        response_format = {"type": "json_object"},
        temperature     = 0.2,
        max_tokens      = settings.openai_max_tokens,
    )

    raw_text = response.choices[0].message.content or "{}"

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(f"[openai] Output no es JSON válido: {e}\nRaw: {raw_text[:500]}")
        raise RuntimeError(f"La IA retornó un JSON inválido: {e}")


# ─── Función de limpieza para MinIO (AHORA SÍ EN EL LUGAR CORRECTO) ──────
async def _cleanup_minio_files(minio, record_id: str, file_metadata: list[dict]):
    """
    Limpia archivos subidos a MinIO en caso de error en el proceso.
    Evita dejar archivos huérfanos cuando la transacción falla.
    """
    if not file_metadata:
        logger.debug("[minutes] No hay archivos para limpiar en MinIO")
        return
    
    logger.info(f"[minutes] Limpiando {len(file_metadata)} archivos de MinIO para record {record_id}")
    archivos_eliminados = 0
    archivos_con_error = 0
    
    for meta in file_metadata:
        try:
            obj_key = f"{record_id}/{meta['fileName']}"
            minio.remove_object(BUCKET_INPUTS, obj_key)
            logger.info(f"[minutes] Archivo limpiado de MinIO: {obj_key}")
            archivos_eliminados += 1
        except Exception as e:
            logger.warning(f"[minutes] Error limpiando archivo {meta.get('fileName', 'unknown')} de MinIO: {e}")
            archivos_con_error += 1
    
    logger.info(f"[minutes] Limpieza completada: {archivos_eliminados} eliminados, {archivos_con_error} con errores")

# ─── Función principal ────────────────────────────────────────────────────────

async def generate_minute(
    db:              Session,
    request:         MinuteGenerateRequest,
    files:           list[UploadFile],
    requested_by_id: str,
) -> MinuteGenerateResponse:
    """
    Orquesta la creación completa de una minuta.
    """
    # Importaciones diferidas de catálogos para evitar circular imports
    from models.artifact_states  import ArtifactState
    from models.artifact_types   import ArtifactType
    from models.buckets          import Bucket
    from models.record_statuses  import RecordStatus
    from models.record_types     import RecordType
    from models.version_statuses import VersionStatus
    from models.ai_profiles import AiProfile  # ← IMPORTANTE: Importar AiProfile

    transaction_id = str(uuid.uuid4())
    record_id      = str(uuid.uuid4())
    now            = _now_utc()

    # 🔥 NUEVO: Lista para guardar referencias a artefactos
    artefactos_creados = []

    logger.info(
        f"[minutes] Iniciando | record={record_id} tx={transaction_id} user={requested_by_id}"
    )

    # ── Resolver IDs de catálogo ──────────────────────────────────────────────
    record_type_id    = _get_catalog_id(db, RecordType,    RECORD_TYPE_MINUTE)
    record_status_id  = _get_catalog_id(db, RecordStatus,  RECORD_STATUS_ACCEPTED)
    version_status_id = _get_catalog_id(db, VersionStatus, VERSION_STATUS_PUBLISHED)
    bucket_inputs_id  = _get_catalog_id(db, Bucket,        BUCKET_CODE_INPUTS)
    bucket_json_id    = _get_catalog_id(db, Bucket,        BUCKET_CODE_JSON)
    art_transcript_id = _get_catalog_id(db, ArtifactType,  ART_INPUT_TRANSCRIPT)
    art_summary_id    = _get_catalog_id(db, ArtifactType,  ART_INPUT_SUMMARY)
    art_llm_orig_id   = _get_catalog_id(db, ArtifactType,  ART_LLM_JSON_ORIG)
    art_canonical_id  = _get_catalog_id(db, ArtifactType,  ART_CANONICAL_JSON)
    state_original_id = _get_catalog_id(db, ArtifactState, ART_STATE_ORIGINAL)
    state_ready_id    = _get_catalog_id(db, ArtifactState, ART_STATE_READY)
    state_failed_id   = _get_catalog_id(db, ArtifactState, ART_STATE_FAILED)

    # ── Cargar datos del perfil AI desde BD ───────────────────────────────────
    profile_data = _get_ai_profile_data(db, request.profile_info.profile_id)

    # =========================================================================
    # 🔥 VALIDACIONES CRÍTICAS - COLOCAR AQUÍ
    # =========================================================================
    
    # Validar que el perfil AI existe en la BD
    ai_profile_id = request.profile_info.profile_id
    if not ai_profile_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "missing_ai_profile",
                "message": "Se requiere un perfil de IA para generar la minuta",
                "transaction_id": transaction_id
            }
        )
    
    # Verificar existencia en tabla ai_profiles
    profile_exists = db.query(AiProfile).filter(
        AiProfile.id == ai_profile_id,
        AiProfile.deleted_at.is_(None)
    ).first()
    
    if not profile_exists:
        logger.error(f"[minutes] Perfil AI no encontrado en BD: {ai_profile_id}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "invalid_ai_profile",
                "message": f"El perfil de IA '{ai_profile_id}' no existe o está inactivo",
                "transaction_id": transaction_id
            }
        )

    # ── Título para el Record ─────────────────────────────────────────────────
    record_title = (
        request.meeting_info.title
        or f"Reunión {request.project_info.client} – {request.meeting_info.scheduled_date}"
    )

    # ── Resolver client_id ────────────────────────────────────────────────────
    raw_client_id  = getattr(request.project_info, "client_id", None)
    raw_project_id = getattr(request.project_info, "project_id", None)
    client_id  = raw_client_id  or _get_placeholder_client_id(db)
    project_id = raw_project_id or None

    # Validar cliente (si aplica)
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "missing_client",
                "message": "Se requiere un cliente para generar la minuta",
                "transaction_id": transaction_id
            }
        )

    # =========================================================================
    # FIN DE VALIDACIONES
    # =========================================================================

    # ── 1. Crear Record ───────────────────────────────────────────────────────
    record = Record(
        id                   = record_id,
        record_type_id       = record_type_id,
        status_id            = record_status_id,
        client_id            = client_id,
        project_id           = project_id,
        ai_profile_id        = ai_profile_id,  # ← Ahora sabemos que existe
        title                = record_title,
        document_date        = _parse_date(request.meeting_info.scheduled_date),
        location             = request.meeting_info.location,
        scheduled_start_time = _parse_time(request.meeting_info.scheduled_start_time),
        scheduled_end_time   = _parse_time(request.meeting_info.scheduled_end_time),
        actual_start_time    = _parse_time(request.meeting_info.actual_start_time),
        actual_end_time      = _parse_time(request.meeting_info.actual_end_time),
        prepared_by_user_id  = requested_by_id,
        latest_version_num   = 0,
        created_by           = requested_by_id,
    )
    db.add(record)

    # ── 2. Crear MinuteTransaction ────────────────────────────────────────────
    tx = MinuteTransaction(
        id            = transaction_id,
        record_id     = record_id,
        status        = "pending",
        requested_by  = requested_by_id,
        ai_profile_id = ai_profile_id,
        created_at    = now,
    )
    db.add(tx)
    
    try:
        db.flush()  # FK record_id debe existir antes del flush de la tx
    except IntegrityError as e:
        logger.error(f"[minutes] Error de integridad al crear record: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "database_integrity_error",
                "message": "Error al crear el registro. Verifica los datos proporcionados.",
                "transaction_id": transaction_id
            }
        )

    # ── 3. Leer archivos y subir a MinIO ──────────────────────────────────────
    minio = get_minio_client()

    file_metadata:   list[dict]     = []
    input_object_id: Optional[str]  = None

    for upload in files:
        raw   = await upload.read()
        sha   = _sha256_bytes(raw)
        fname = upload.filename or "archivo.txt"
        mime  = _normalize_mime(upload.content_type or "text/plain")
        ext   = _ext_from_filename(fname)

        # Determinar tipo de artefacto por nombre de archivo
        fname_lower = fname.lower()
        if "resumen" in fname_lower or "summary" in fname_lower:
            art_type_id = art_summary_id
            file_type   = "summary"
        else:
            art_type_id = art_transcript_id
            file_type   = "transcription"

        obj_key = f"{record_id}/{fname}"
        obj_id  = str(uuid.uuid4())

        # Subir a MinIO (nombre real del bucket)
        minio.put_object(
            bucket_name  = BUCKET_INPUTS,
            object_name  = obj_key,
            data         = io.BytesIO(raw),
            length       = len(raw),
            content_type = mime,
        )
        logger.info(f"[minutes] Subido a MinIO: {BUCKET_INPUTS}/{obj_key}")

        # Registrar Object (campos exactos según models/objects.py)
        db.add(_build_object_row(
            obj_id       = obj_id,
            bucket_id    = bucket_inputs_id,
            object_key   = obj_key,
            content_type = _normalize_mime(mime),
            file_ext     = ext,
            size_bytes   = len(raw),
            sha256       = sha,
            created_by   = requested_by_id,
        ))

        # Registrar RecordArtifact de entrada
        artefacto = _build_artifact_row(
            record_id         = record_id,
            artifact_type_id  = art_type_id,
            artifact_state_id = state_original_id,
            object_id         = obj_id,
            created_by        = requested_by_id,
            record_version_id = None,
            is_draft          = False,
            natural_name      = fname,
        )
        db.add(artefacto)
        artefactos_creados.append(artefacto)  # ← AGREGAR A LA LISTA

        file_metadata.append({
            "fileName": fname,
            "mimeType": mime,
            "sha256":   sha,
            "fileType": file_type,
        })

        if input_object_id is None:
            input_object_id = obj_id
       

    # Actualizar tx → processing
    tx.status          = "processing"
    tx.input_object_id = input_object_id
    # db.flush()

    # ── 4. Llamar a OpenAI ────────────────────────────────────────────────────
    ai_input = _build_ai_input_schema(request, transaction_id, file_metadata)

    # Crear directorio temp si no existe
    TEMP_DIR = "/app/assets/temp"
    os.makedirs(TEMP_DIR, exist_ok=True)

    try:
        # Validar que tenemos archivos para enviar
        if not file_metadata:
            raise ValueError("No hay metadatos de archivos para procesar")
        
        files_for_openai = _reload_files_from_minio(minio, BUCKET_INPUTS, record_id, file_metadata)
        
        # Validar que pudimos recargar los archivos
        if not files_for_openai:
            raise ValueError("No se pudieron recargar los archivos desde MinIO")
        
        if len(files_for_openai) != len(file_metadata):
            logger.warning(f"Solo se recargaron {len(files_for_openai)} de {len(file_metadata)} archivos")
        
        ai_output = await _call_openai(
            ai_input         = ai_input,
            files_bytes      = files_for_openai,
            profile_data     = profile_data,
            additional_notes = request.additional_notes or "",
        )
        
        # 🔥 GUARDAR RESPUESTA DE OPENAI PARA DEPURACIÓN
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"openai_response_{timestamp}.json"
        filepath = os.path.join(TEMP_DIR, filename)
        
        # Preparar objeto para guardar (incluye metadata)
        response_to_save = {
            "timestamp": datetime.now().isoformat(),
            "transaction_id": transaction_id,
            "record_id": record_id,
            "ai_input": ai_input,
            "ai_output": ai_output,
            "validation_status": "pending"
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(response_to_save, f, ensure_ascii=False, indent=2)
        
        logger.info(f"[minutes] Respuesta de OpenAI guardada en: {filepath}")
        
        # 🔥 VALIDACIÓN ESTRICTA DE LA RESPUESTA (ÚNICA Y CORRECTA)
        if not isinstance(ai_output, dict):
            logger.error(f"[minutes] OpenAI no retornó un dict, tipo: {type(ai_output)}")
            response_to_save["validation_status"] = "error_not_dict"
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(response_to_save, f, ensure_ascii=False, indent=2)
            raise ValueError("OpenAI no retornó un objeto JSON válido")
        
        # Verificar secciones requeridas según el prompt
        required_sections = ["introduction", "topics", "agreements", "requirements", "nextMeetings"]
        missing_sections = [section for section in required_sections if section not in ai_output]
        
        if missing_sections:
            logger.error(f"[minutes] Respuesta de OpenAI incompleta. Faltan: {missing_sections}")
            logger.error(f"[minutes] Respuesta parcial: {json.dumps(ai_output, indent=2)[:500]}")
            
            response_to_save["validation_status"] = "error_missing_sections"
            response_to_save["missing_sections"] = missing_sections
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(response_to_save, f, ensure_ascii=False, indent=2)
            
            raise ValueError(f"La respuesta de OpenAI no contiene las secciones requeridas: {missing_sections}")
        
        # Verificar estructura interna de introduction
        if not isinstance(ai_output.get("introduction"), dict):
            logger.error(f"[minutes] 'introduction' no es un diccionario")
            response_to_save["validation_status"] = "error_introduction_not_dict"
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(response_to_save, f, ensure_ascii=False, indent=2)
            raise ValueError("La sección 'introduction' debe ser un objeto")
        
        intro_content = ai_output["introduction"].get("content")
        if not isinstance(intro_content, dict) or "summary" not in intro_content:
            logger.error(f"[minutes] 'introduction.content' no tiene la estructura esperada")
            response_to_save["validation_status"] = "error_introduction_structure"
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(response_to_save, f, ensure_ascii=False, indent=2)
            raise ValueError("La introducción debe contener 'content.summary'")
        
        # Verificar que topics sea una lista
        if not isinstance(ai_output.get("topics"), list):
            logger.error(f"[minutes] 'topics' no es una lista")
            response_to_save["validation_status"] = "error_topics_not_list"
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(response_to_save, f, ensure_ascii=False, indent=2)
            raise ValueError("La sección 'topics' debe ser una lista")
        
        # Verificar estructura básica de agreements (opcional pero recomendado)
        if not isinstance(ai_output.get("agreements"), list):
            logger.warning(f"[minutes] 'agreements' no es una lista, se usará lista vacía")
            ai_output["agreements"] = []
        
        # Verificar estructura básica de requirements (opcional pero recomendado)
        if not isinstance(ai_output.get("requirements"), list):
            logger.warning(f"[minutes] 'requirements' no es una lista, se usará lista vacía")
            ai_output["requirements"] = []
        
        # Verificar estructura básica de nextMeetings (opcional pero recomendado)
        if not isinstance(ai_output.get("nextMeetings"), list):
            logger.warning(f"[minutes] 'nextMeetings' no es una lista, se usará lista vacía")
            ai_output["nextMeetings"] = []
        
        # Si llegamos aquí, la respuesta es válida
        logger.info("[minutes] Respuesta de OpenAI válida recibida")
        response_to_save["validation_status"] = "valid"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(response_to_save, f, ensure_ascii=False, indent=2)

    except openai.RateLimitError as e:
        logger.error(f"[minutes] Límite de cuota OpenAI excedido: {e}")
        tx.status = "failed"
        tx.error_message = "Límite de cuota de IA excedido. Por favor, intenta más tarde."
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "rate_limit_exceeded",
                "message": "Límite de cuota de IA excedido. Por favor, intenta más tarde.",
                "transaction_id": transaction_id,
                "record_id": record_id
            }
        )

    except openai.BadRequestError as e:
        logger.error(f"[minutes] Error en solicitud a OpenAI: {e}")
        tx.status = "failed"
        tx.error_message = f"Error en solicitud a IA: {str(e)}"
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "invalid_ai_request",
                "message": "La solicitud a la IA fue rechazada. Verifica los archivos adjuntos.",
                "transaction_id": transaction_id,
                "record_id": record_id
            }
        )

    except openai.AuthenticationError as e:
        logger.error(f"[minutes] Error de autenticación OpenAI: {e}")
        tx.status = "failed"
        tx.error_message = "Error de configuración del servicio de IA"
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "ai_auth_error",
                "message": "Error de configuración del servicio de IA. Contacta al administrador.",
                "transaction_id": transaction_id,
                "record_id": record_id
            }
        )

    except openai.APITimeoutError as e:
        logger.error(f"[minutes] Timeout en OpenAI: {e}")
        tx.status = "failed"
        tx.error_message = "Tiempo de espera agotado"
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "error": "ai_timeout",
                "message": "El servicio de IA tardó demasiado en responder. Intenta nuevamente.",
                "transaction_id": transaction_id,
                "record_id": record_id
            }
        )

    except openai.APIError as e:
        logger.error(f"[minutes] Error interno de OpenAI: {e}")
        tx.status = "failed"
        tx.error_message = "Error interno del servicio de IA"
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "ai_service_error",
                "message": "El servicio de IA no está disponible. Intenta más tarde.",
                "transaction_id": transaction_id,
                "record_id": record_id
            }
        )

    except ValueError as e:
        logger.error(f"[minutes] Error de validación: {e}")
        tx.status = "failed"
        tx.error_message = str(e)
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "validation_error",
                "message": str(e),
                "transaction_id": transaction_id,
                "record_id": record_id
            }
        )

    except Exception as e:
        logger.error(f"[minutes] Error inesperado: {e}", exc_info=True)
        tx.status = "failed"
        tx.error_message = f"Error inesperado: {str(e)}"
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "unexpected_error",
                "message": "Ocurrió un error inesperado al procesar la minuta.",
                "transaction_id": transaction_id,
                "record_id": record_id
            }
        )

    # ── 5. Guardar output JSON en MinIO ───────────────────────────────────────
    ai_output_bytes  = json.dumps(ai_output, ensure_ascii=False, indent=2).encode("utf-8")
    ai_output_key    = f"{record_id}/llm_output_v1.json"
    ai_output_obj_id = str(uuid.uuid4())

    minio.put_object(
        bucket_name  = BUCKET_JSON,
        object_name  = ai_output_key,
        data         = io.BytesIO(ai_output_bytes),
        length       = len(ai_output_bytes),
        content_type = "application/json",
    )

    # Registrar Object del output JSON
    db.add(_build_object_row(
        obj_id       = ai_output_obj_id,
        bucket_id    = bucket_json_id,
        object_key   = ai_output_key,
        content_type = "application/json",
        file_ext     = "json",
        size_bytes   = len(ai_output_bytes),
        sha256       = _sha256_bytes(ai_output_bytes),
        created_by   = requested_by_id,
    ))

    # ✅ PASO 5 (continuación): Crear artefacto LLM_JSON_ORIGINAL
    artefacto_llm = _build_artifact_row(
        record_id         = record_id,
        artifact_type_id  = art_llm_orig_id,
        artifact_state_id = state_original_id,
        object_id         = ai_output_obj_id,
        created_by        = requested_by_id,
        record_version_id = None,  # ← Temporal, se asignará después
        is_draft          = False,  # ← Publicado, necesitará versión
        natural_name      = "llm_output_v1.json",
    )
    db.add(artefacto_llm)
    artefactos_creados.append(artefacto_llm)  # ← AGREGAR A LA LISTA

    # ── 6. CANONICAL_JSON (copia editable del output) ─────────────────────────
    canonical_key    = f"{record_id}/schema_output_v1.json"
    canonical_obj_id = str(uuid.uuid4())

    minio.put_object(
        bucket_name  = BUCKET_JSON,
        object_name  = canonical_key,
        data         = io.BytesIO(ai_output_bytes),
        length       = len(ai_output_bytes),
        content_type = "application/json",
    )

    # Registrar Object del canonical JSON
    db.add(_build_object_row(
        obj_id       = canonical_obj_id,
        bucket_id    = bucket_json_id,
        object_key   = canonical_key,
        content_type = "application/json",
        file_ext     = "json",
        size_bytes   = len(ai_output_bytes),
        sha256       = _sha256_bytes(ai_output_bytes),
        created_by   = requested_by_id,
    ))

    # ✅ PASO 6 (continuación): Crear artefacto CANONICAL_JSON
    artefacto_canonical = _build_artifact_row(
        record_id         = record_id,
        artifact_type_id  = art_canonical_id,
        artifact_state_id = state_ready_id,
        object_id         = canonical_obj_id,
        created_by        = requested_by_id,
        record_version_id = None,  # ← Temporal, se asignará después
        is_draft          = True,   # ← Borrador, no necesita versión
        natural_name      = "schema_output_v1.json",
    )
    db.add(artefacto_canonical)
    artefactos_creados.append(artefacto_canonical)  # ← AGREGAR A LA LISTA

    # ── 7. Crear RecordVersion v1 ─────────────────────────────────────────────
    # PRIMERO: Guardar todos los artefactos en BD (sin versión)
    logger.info(f"[minutes] Guardando {len(artefactos_creados)} artefactos en BD (sin versión)")
    db.flush()  # ← Este flush guarda los artefactos con record_version_id = None

    # AHORA crear la versión
    version_id = str(uuid.uuid4())
    version = RecordVersion(
        id               = version_id,
        record_id        = record_id,
        version_num      = 1,
        status_id        = version_status_id,
        published_by     = requested_by_id,
        schema_version   = "1.0",
        template_version = "1.0",
        ai_model         = settings.openai_model,
    )
    db.add(version)
    db.flush()  # Guarda la versión y obtiene su ID

    # 🔥 AHORA: Actualizar los artefactos en BD con la versión
    logger.info(f"[minutes] Asignando versión {version_id} a {len(artefactos_creados)} artefactos")

    artefactos_publicados = 0
    for art in artefactos_creados:
        # Recargar el artefacto desde la BD para asegurar que existe
        art_en_bd = db.get(RecordArtifact, art.id)
        if art_en_bd:
            art_en_bd.record_version_id = version_id
            if not art_en_bd.is_draft:
                artefactos_publicados += 1
            logger.debug(f"[minutes] Actualizado en BD: {art_en_bd.natural_name}")
        else:
            # Si no está en BD, asignar directamente (fallback)
            art.record_version_id = version_id
            db.merge(art)
            artefactos_publicados += 1
            logger.warning(f"[minutes] Artefacto no encontrado en BD, usando merge: {art.natural_name}")

    logger.info(f"[minutes] Asignados {artefactos_publicados} artefactos publicados a versión {version_id}")

    # Hacemos flush para guardar las asignaciones
    db.flush()

    # ── 8. Actualizar Record y Transaction ────────────────────────────────────
    record.active_version_id  = version_id
    record.latest_version_num = 1
    record.updated_by         = requested_by_id

    tx.status            = "completed"
    tx.output_object_id  = ai_output_obj_id
    tx.record_version_id = version_id
    tx.completed_at      = _now_utc()

    db.commit()


# ─── Status ──────────────────────────────────────────────────────────────────

async def get_minute_status(
    db:             Session,
    transaction_id: str,
) -> MinuteStatusResponse:
    tx = db.query(MinuteTransaction).filter_by(id=transaction_id).first()
    if tx is None:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail      = "Transaction no encontrada",
        )

    def _fmt(dt) -> Optional[str]:
        if dt is None:
            return None
        return dt.isoformat() if hasattr(dt, "isoformat") else str(dt)

    return MinuteStatusResponse(
        transaction_id = tx.id,
        record_id      = tx.record_id,
        status         = tx.status,
        error_message  = tx.error_message,
        created_at     = _fmt(tx.created_at),
        updated_at     = _fmt(getattr(tx, "updated_at", None)),
        completed_at   = _fmt(tx.completed_at),
    )
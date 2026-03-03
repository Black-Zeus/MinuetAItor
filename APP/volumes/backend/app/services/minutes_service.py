# services/minutes_service.py
"""
Servicio de generación de minutas.

Flujo (TWO-TRANSACTION PATTERN):
  ── TX1: Intake ──────────────────────────────────────────────────────────────
  1. Resolver IDs de catálogo desde BD
  2. Crear Record (status_id=ACCEPTED) + MinuteTransaction (pending)
  3. Leer archivos y subir a MinIO → minuetaitor-inputs/{record_id}/
  4. Registrar Objects + RecordArtifacts de entrada en BD
  5. db.commit() ← TX1 COMMIT: todo el intake queda persistido de forma inmutable
  ── TX2: Procesamiento ───────────────────────────────────────────────────────
  6. Construir AI input schema
  7. Llamar a OpenAI (base64 inline en Chat Completions)
  8. Guardar output JSON en MinIO → minuetaitor-json/{record_id}/
  9. Registrar Objects + RecordArtifacts de salida en BD
  10. Crear RecordVersion v1 + RecordDraft
  11. Actualizar Record (active_version_id) + MinuteTransaction (completed)
  12. db.commit() ← TX2 COMMIT: procesamiento exitoso
  ── Manejo de errores en TX2 ─────────────────────────────────────────────────
  - Cualquier excepción en TX2 hace db.rollback() (deshace solo los artefactos
    de output parciales), luego commitea tx.status="failed" por separado.
  - Los inputs (Objects en MinIO + BD) de TX1 NUNCA se pierden. La MinuteTransaction
    error, garantizando auditoría forense completa.
  - Los archivos en MinIO (inputs) se conservan como evidencia.

SÍNCRONO en v1.
TODO: mover a tarea async (Celery/ARQ) cuando el tiempo de procesamiento lo justifique.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import openai

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
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

# ─── Constantes de catálogo ───────────────────────────────────────────────────
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

PROMPT_FILE      = settings.openai_system_prompt
PROMPT_PATH_BASE = Path("/app/assets/prompts")
TRACE_BASE_DIR   = "/app/assets/temp"


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
_MIME_NORMALIZE: dict[str, str] = {
    "text/plain":                    "text/plain",
    "text/plain; charset=utf8":      "text/plain",
    "text/plain;charset=utf-8":      "text/plain",
    "text/plain;charset=utf8":       "text/plain",
    "application/json":              "application/json",
    "application/pdf":               "application/pdf",
    "image/png":                     "image/png",
    "image/jpeg":                    "image/jpeg",
    "image/jpg":                     "image/jpeg",
}


def _normalize_mime(mime: str) -> str:
    normalized = _MIME_NORMALIZE.get(mime.strip().lower())
    if normalized:
        return normalized
    logger.warning(f"[minutes] MIME no normalizado: '{mime}' — puede fallar en BD")
    return mime


def _get_catalog_id(db: Session, model_class, code: str):
    obj = db.query(model_class).filter_by(code=code).first()
    if obj is None:
        raise RuntimeError(
            f"Catálogo '{model_class.__tablename__}' con code='{code}' "
            f"no encontrado en BD. Verifica los seeds."
        )
    return obj.id


def _parse_date(value: Optional[str]):
    if not value:
        return None
    try:
        from datetime import date
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _parse_time(value: Optional[str]):
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
    from models.clients import Client
    client = db.query(Client).filter_by(is_active=True).first()
    if client is None:
        raise RuntimeError(
            "No existe ningún cliente activo en BD. "
            "Crea un cliente antes de generar minutas."
        )
    return str(client.id)


def _get_ai_profile_data(db: Session, profile_id: str) -> dict:
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
    record_version_id: Optional[str] = None,
    is_draft:          bool = False,
    natural_name:      Optional[str] = None,
) -> RecordArtifact:
    return RecordArtifact(
        record_id         = record_id,
        artifact_type_id  = artifact_type_id,
        artifact_state_id = artifact_state_id,
        object_id         = object_id,
        record_version_id = record_version_id,
        is_draft          = is_draft,
        natural_name      = natural_name,
        created_by        = created_by,
    )


def _calculate_prompt_sha() -> str:
    """
    Calcula el SHA256 del contenido del archivo de prompt.
    Returns:
        String con el hash SHA256 en hexadecimal
    """
    try:
        prompt_path = PROMPT_PATH_BASE / PROMPT_FILE

        if not prompt_path.exists():
            return f"file_not_found_{PROMPT_FILE}"

        with open(prompt_path, 'rb') as f:
            file_content = f.read()
            return _sha256_bytes(file_content)

    except Exception as e:
        print(f"Error calculando SHA para prompt {PROMPT_FILE}: {e}")
        return f"error_calculating_sha_{PROMPT_FILE}"


def _build_ai_input_schema(
    request:        MinuteGenerateRequest,
    transaction_id: str,
    file_metadata:  list[dict],
) -> dict:
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
        # ── CAMBIO CLAVE ──────────────────────────────────────────────────────
        # Renombrado de "participants" a "declaredParticipants".
        # El modelo (v05) lo trata como referencia adicional, no como verdad.
        # La fuente primaria de participantes son los archivos adjuntos.
        "declaredParticipants": {
            "attendees": pa.attendees,
            "note": (
                "Lista declarada por el usuario al crear la solicitud. "
                "Puede estar incompleta. "
                "Extraer participantes reales desde los archivos adjuntos."
            ),
        },
        # ─────────────────────────────────────────────────────────────────────
        "profileInfo": {
            "profileId":   pr.profile_id,
            "profileName": pr.profile_name,
        },
        "preparedBy": request.prepared_by,
        "systemPrompt": {
            "name": PROMPT_FILE,
            "signedSha": _calculate_prompt_sha(),
        },
    }

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
        schema["declaredParticipants"]["invited"] = pa.invited
    if pa.copy_recipients:
        schema["declaredParticipants"]["copyRecipients"] = pa.copy_recipients
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
    prompt_path = PROMPT_PATH_BASE / PROMPT_FILE

    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            template = f.read()

        prompt = template
        prompt = prompt.replace("{profileId}",          profile_id)
        prompt = prompt.replace("{profileName}",        profile_name)
        prompt = prompt.replace("{profileDescription}", profile_description)
        prompt = prompt.replace("{profilePrompt}",      profile_prompt or "Analiza la reunión de forma general y objetiva.")
        prompt = prompt.replace("{additionalNotes}",    additional_notes or "Sin notas adicionales.")
        prompt = prompt.replace("{userTags}",           user_tags or "Sin etiquetas.")
        return prompt

    logger.warning(f"[minutes] Prompt no encontrado en {prompt_path}. Usando fallback.")
    return (
        f"Eres un asistente especializado en análisis de reuniones. "
        f"Perfil: {profile_name}. {profile_prompt}"
    )


def _validate_file_mime(fname: str, resolved_mime: str) -> None:
    """
    Valida que el MIME type del archivo sea soportado.
    El mensaje incluye los formatos aceptados para facilitar el debugging.
    """
    if resolved_mime not in settings.minutes_supported_mimes:
        supported = ", ".join(settings.minutes_supported_mimes.keys())
        raise ValueError(
            f"Formato no soportado: '{fname}' ({resolved_mime}). "
            f"Formatos aceptados: {supported}"
        )


def _model_supports_file_blocks(model: str) -> bool:
    """
    Retorna True si el modelo soporta bloques 'type: file' en Chat Completions.
    La lista se lee desde settings para poder actualizar sin tocar el código.
    """
    model_lower = model.lower()
    return any(m.lower() in model_lower for m in settings.openai_models_with_file_support)


# ─── Trazabilidad local (debug) ───────────────────────────────────────────────

def _init_trace_dir(transaction_id: str, record_id: str) -> str:
    """
    Crea una carpeta de trazabilidad por transacción:
      /app/assets/temp/{YYYYMMDD_HHMMSS}_{transaction_id[:8]}/
    """
    timestamp   = datetime.now().strftime("%Y%m%d_%H%M%S")
    folder_name = f"{timestamp}_{transaction_id[:8]}"
    trace_dir   = os.path.join(TRACE_BASE_DIR, folder_name)
    os.makedirs(trace_dir, exist_ok=True)

    meta = {
        "transaction_id": transaction_id,
        "record_id":      record_id,
        "created_at":     datetime.now().isoformat(),
        "status":         "initiated",
    }
    with open(os.path.join(trace_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    logger.info(f"[trace] Carpeta de trazabilidad: {trace_dir}")
    return trace_dir


def _save_trace_input(trace_dir: str, ai_input: dict, prompt_system: str) -> None:
    """Guarda el payload enviado al modelo (input JSON + prompt del sistema)."""
    with open(os.path.join(trace_dir, "ai_input.json"), "w", encoding="utf-8") as f:
        json.dump(ai_input, f, ensure_ascii=False, indent=2)

    with open(os.path.join(trace_dir, PROMPT_FILE), "w", encoding="utf-8") as f:
        f.write(prompt_system)

    logger.debug(f"[trace] ai_input.json y {PROMPT_FILE} guardados")


def _save_trace_attachments(
    trace_dir:   str,
    files_bytes: list[tuple[str, bytes, str]],
) -> None:
    """Guarda una copia de cada adjunto enviado al modelo."""
    attachments_dir = os.path.join(trace_dir, "attachments")
    os.makedirs(attachments_dir, exist_ok=True)

    index = []
    for fname, raw, mime in files_bytes:
        dest_path = os.path.join(attachments_dir, fname)
        with open(dest_path, "wb") as f:
            f.write(raw)
        index.append({
            "fileName":  fname,
            "mimeType":  mime,
            "sizeBytes": len(raw),
            "sha256":    _sha256_bytes(raw),
        })
        logger.debug(f"[trace] Adjunto guardado: {fname} ({len(raw)} bytes)")

    with open(os.path.join(attachments_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


def _save_trace_output(
    trace_dir:         str,
    ai_output:         dict,
    validation_status: str,
    missing_sections:  Optional[list] = None,
) -> None:
    """Guarda la respuesta del modelo y el resultado de validación."""
    result = {
        "received_at":       _now_utc().isoformat(),
        "validation_status": validation_status,
        "ai_output":         ai_output,
    }
    if missing_sections:
        result["missing_sections"] = missing_sections

    with open(os.path.join(trace_dir, "ai_output.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    logger.debug(f"[trace] ai_output.json guardado (status={validation_status})")


def _finalize_trace(trace_dir: str, final_status: str, error: Optional[str] = None) -> None:
    """Actualiza meta.json con el estado final de la transacción."""
    meta_path = os.path.join(trace_dir, "meta.json")
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
    except Exception:
        meta = {}

    meta["status"]       = final_status
    meta["finalized_at"] = _now_utc().isoformat()
    if error:
        meta["error"] = error

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


# ─── Commit helper para estado fallido ───────────────────────────────────────

def _commit_failed_state(
    db:            Session,
    tx:            MinuteTransaction,
    error_message: str,
    transaction_id: str,
    record_id:     str,
) -> None:
    """
    Después de un db.rollback() en TX2, persiste el estado 'failed' de la
    MinuteTransaction en un commit separado para garantizar auditoría.

    TX1 ya habrá commiteado Record + Objects de input, por lo que la FK
    de MinuteTransaction a Record sigue siendo válida incluso tras el rollback.
    """
    try:
        # Re-merge necesario: el rollback expulsó tx de la sesión identity map
        tx = db.merge(tx)
        tx.status        = "failed"
        tx.error_message = error_message
        db.commit()
        logger.info(
            f"[minutes] Estado 'failed' commiteado | tx={transaction_id} record={record_id}"
        )
    except Exception as commit_err:
        logger.error(
            f"[minutes] CRÍTICO: no se pudo commitear estado failed | "
            f"tx={transaction_id} error={commit_err}",
            exc_info=True,
        )
        # No re-raise: ya estamos en manejo de error, el raise original sigue adelante


# ─── Llamada a OpenAI ─────────────────────────────────────────────────────────

def _call_openai(
    prompt_system:  str,
    files_for_openai: list[tuple[str, bytes, str]],
    ai_input:       dict,
    trace_dir:      Optional[str],
) -> dict:
    """
    Construye el mensaje y llama a la API de OpenAI.
    Retorna el dict parseado del JSON de respuesta.
    Lanza excepciones openai.* o ValueError/RuntimeError ante fallos.
    """
    # MIMEs que el bloque nativo 'type: file' de OpenAI acepta.
    # Todo lo demás se manda como texto plano inlineado.
    _FILE_BLOCK_MIMES = {"application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"}

    use_file_blocks = _model_supports_file_blocks(settings.openai_model)

    content_parts: list[dict] = [
        {
            "type": "text",
            "text": json.dumps(ai_input, ensure_ascii=False),
        }
    ]

    for fname, raw, mime in files_for_openai:
        if use_file_blocks and mime in _FILE_BLOCK_MIMES:
            # PDF o imagen soportada: bloque nativo
            b64 = base64.b64encode(raw).decode("utf-8")
            if mime.startswith("image/"):
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{b64}"},
                })
            else:
                content_parts.append({
                    "type": "file",
                    "file": {
                        "filename": fname,
                        "file_data": f"data:{mime};base64,{b64}",
                    },
                })
            logger.debug(f"[openai] {fname} → bloque nativo ({mime})")
        else:
            # text/plain, application/json, u otro no soportado → inline como texto
            text_content = raw.decode("utf-8", errors="replace")
            content_parts.append({
                "type": "text",
                "text": f"--- Archivo: {fname} ---\n{text_content}\n--- Fin: {fname} ---",
            })
            logger.debug(f"[openai] {fname} → inline texto ({mime})")

    client_oa = openai.OpenAI(api_key=settings.openai_api_key)

    response = client_oa.chat.completions.create(
        model       = settings.openai_model,
        max_tokens  = settings.openai_max_tokens,
        temperature = settings.openai_temperature,
        messages    = [
            {"role": "system", "content": prompt_system},
            {"role": "user",   "content": content_parts},
        ],
    )

    raw_text = response.choices[0].message.content or ""

    # Limpiar posibles bloques de código markdown
    raw_text = raw_text.strip()
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        raw_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    # Verificar límite de tokens de contexto
    usage = getattr(response, "usage", None)
    if usage:
        total = getattr(usage, "total_tokens", 0)
        limit = getattr(settings, "openai_context_limit", 128_000)
        if total >= int(limit * 0.95):
            logger.warning(
                f"[openai] Uso de tokens cercano al límite: {total}/{limit}"
            )
            raise ValueError(
                "La sesión es demasiado extensa para procesarse en un solo archivo. "
                "Te recomendamos dividirla en dos partes (por ejemplo, primera y segunda mitad) "
                "y generar una minuta por cada parte."
            )

    # Parsear JSON
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(f"[openai] Output no es JSON válido: {e}\nRaw: {raw_text[:500]}")
        raise RuntimeError(f"La IA retornó un JSON inválido: {e}")


# ─── Función principal ────────────────────────────────────────────────────────

async def generate_minute(
    db:              Session,
    request:         MinuteGenerateRequest,
    files:           list[UploadFile],
    requested_by_id: str,
) -> MinuteGenerateResponse:
    """
    Orquesta la creación completa de una minuta usando el two-transaction pattern.

    TX1 commitea el intake (Record + MinuteTransaction + Objects de input) de forma inmutable
    antes de llamar a la IA. TX2 maneja el procesamiento; cualquier fallo en TX2
    hace rollback solo de los artefactos de output parciales, y luego commitea
    tx.status="failed" para garantizar auditoría forense completa.
    """
    from models.artifact_states  import ArtifactState
    from models.artifact_types   import ArtifactType
    from models.buckets          import Bucket
    from models.record_drafts    import RecordDraft
    from models.record_statuses  import RecordStatus
    from models.record_types     import RecordType
    from models.version_statuses import VersionStatus
    from models.ai_profiles      import AiProfile

    transaction_id = str(uuid.uuid4())
    record_id      = str(uuid.uuid4())
    now            = _now_utc()
    artefactos_output: list[RecordArtifact] = []   # artefactos de TX2 (outputs)
    file_metadata:     list[dict]           = []
    trace_dir:         Optional[str]        = None
    tx:                Optional[MinuteTransaction] = None

    logger.info(f"[minutes] Iniciando | record={record_id} tx={transaction_id} user={requested_by_id}")

    # ── Inicializar carpeta de trazabilidad ───────────────────────────────────
    try:
        trace_dir = _init_trace_dir(transaction_id, record_id)
    except Exception as e:
        logger.warning(f"[trace] No se pudo crear carpeta de trazabilidad: {e}")

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
    state_failed_id   = _get_catalog_id(db, ArtifactState, ART_STATE_FAILED)  # noqa: F841

    # ── Cargar perfil AI ──────────────────────────────────────────────────────
    profile_data  = _get_ai_profile_data(db, request.profile_info.profile_id)
    ai_profile_id = request.profile_info.profile_id

    if not ai_profile_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "missing_ai_profile", "message": "Se requiere un perfil de IA"},
        )

    profile_exists = db.query(AiProfile).filter(
        AiProfile.id == ai_profile_id,
        AiProfile.deleted_at.is_(None),
    ).first()

    if not profile_exists:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error":   "invalid_ai_profile",
                "message": f"Perfil '{ai_profile_id}' no existe o está inactivo",
            },
        )

    # ── Resolver client_id / project_id ──────────────────────────────────────
    raw_client_id  = getattr(request.project_info, "client_id", None)
    raw_project_id = getattr(request.project_info, "project_id", None)
    client_id  = raw_client_id  or _get_placeholder_client_id(db)
    project_id = raw_project_id or None

    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "missing_client", "message": "Se requiere un cliente"},
        )

    record_title = (
        request.meeting_info.title
        or f"Reunión {request.project_info.client} – {request.meeting_info.scheduled_date}"
    )

    # ═════════════════════════════════════════════════════════════════════════
    # TX1 — INTAKE: Record + MinuteTransaction + archivos de input
    # Objetivo: persistir de forma inmutable TODO lo recibido del usuario antes
    # de llamar a la IA. Si la IA falla, estos datos NO se pierden.
    # ═════════════════════════════════════════════════════════════════════════

    # ── 1. Crear Record ───────────────────────────────────────────────────────
    record = Record(
        id                   = record_id,
        record_type_id       = record_type_id,
        status_id            = record_status_id,
        client_id            = client_id,
        project_id           = project_id,
        ai_profile_id        = ai_profile_id,
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
        db.flush()
    except IntegrityError as e:
        logger.error(f"[minutes] Error de integridad al crear record/tx: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "database_integrity_error", "message": "Error al crear el registro."},
        )

    # ── 3. Leer archivos y subir a MinIO ──────────────────────────────────────
    # Solo se persisten los Objects (punteros MinIO) en TX1.
    # Los RecordArtifacts de input se crean en TX2 junto con la RecordVersion,
    # ya que el trigger exige record_version_id en artefactos publicados (is_draft=0)
    # y exige record_drafts vigente en artefactos draft (is_draft=1).
    # TX1 no tiene aún ni versión ni draft, así que los artefactos no pueden existir.
    minio = get_minio_client()
    input_object_id: Optional[str] = None

    # input_objects_meta: lista de dicts con toda la info necesaria para crear
    # los RecordArtifacts en TX2 una vez que tengamos record_version_id.
    input_objects_meta: list[dict] = []

    for upload in files:
        raw   = await upload.read()
        sha   = _sha256_bytes(raw)
        fname = upload.filename or "archivo.txt"
        mime  = _normalize_mime(upload.content_type or "text/plain")
        ext   = _ext_from_filename(fname)

        fname_lower = fname.lower()
        if "resumen" in fname_lower or "summary" in fname_lower:
            art_type_id = art_summary_id
            file_type   = "summary"
        else:
            art_type_id = art_transcript_id
            file_type   = "transcription"

        obj_key = f"{record_id}/{fname}"
        obj_id  = str(uuid.uuid4())

        minio.put_object(
            bucket_name  = BUCKET_INPUTS,
            object_name  = obj_key,
            data         = io.BytesIO(raw),
            length       = len(raw),
            content_type = mime,
        )
        logger.info(f"[minutes] Subido a MinIO: {BUCKET_INPUTS}/{obj_key}")

        # Solo el Object se agrega a la sesión en TX1
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

        # Guardamos la metadata para crear el RecordArtifact en TX2
        input_objects_meta.append({
            "obj_id":      obj_id,
            "art_type_id": art_type_id,
            "fname":       fname,
        })

        file_metadata.append({
            "fileName": fname,
            "mimeType": mime,
            "sha256":   sha,
            "fileType": file_type,
        })

        if input_object_id is None:
            input_object_id = obj_id

    tx.status          = "processing"
    tx.input_object_id = input_object_id

    # ── TX1 COMMIT ────────────────────────────────────────────────────────────
    # Persiste de forma inmutable: Record + MinuteTransaction + Objects de input.
    # Los archivos en MinIO ya están subidos. Si la IA falla posteriormente,
    # esta evidencia NO se pierde — el Record y la tx quedan en BD con status
    # "processing" hasta que TX2 los actualice a "completed" o "failed".
    try:
        db.commit()
        logger.info(
            f"[minutes] TX1 commiteada — intake persistido | "
            f"record={record_id} tx={transaction_id} archivos={len(file_metadata)}"
        )
    except Exception as e:
        logger.error(f"[minutes] Error en TX1 commit: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error":   "tx1_commit_error",
                "message": "Error al persistir el intake de la minuta.",
            },
        )

    # ═════════════════════════════════════════════════════════════════════════
    # TX2 — PROCESAMIENTO: OpenAI + artefactos de output + versión
    # Cualquier excepción aquí hace rollback solo de TX2, luego commitea
    # el estado "failed" en la MinuteTransaction para preservar auditoría.
    # ═════════════════════════════════════════════════════════════════════════

    # ── 4. Construir AI input + prompt ────────────────────────────────────────
    ai_input = _build_ai_input_schema(request, transaction_id, file_metadata)

    # Construir prompt ANTES de llamar — necesario para trazabilidad en caso de error
    prompt_system = _load_agent_prompt(
        profile_id          = profile_data["profile_id"],
        profile_name        = profile_data["profile_name"],
        profile_description = profile_data["profile_description"],
        profile_prompt      = profile_data["profile_prompt"],
        additional_notes    = request.additional_notes or "",
        user_tags           = "",
    )

    # ── 5. Llamar a OpenAI ────────────────────────────────────────────────────
    ai_output: Optional[dict] = None

    try:
        if not file_metadata:
            raise ValueError("No hay metadatos de archivos para procesar")

        files_for_openai = _reload_files_from_minio(minio, BUCKET_INPUTS, record_id, file_metadata)

        if not files_for_openai:
            raise ValueError("No se pudieron recargar los archivos desde MinIO")

        if len(files_for_openai) != len(file_metadata):
            logger.warning(
                f"[minutes] Solo se recargaron {len(files_for_openai)} "
                f"de {len(file_metadata)} archivos"
            )

        # Trazabilidad ANTES de llamar — si el modelo falla el input ya está guardado
        if trace_dir:
            try:
                _save_trace_input(trace_dir, ai_input, prompt_system)
                _save_trace_attachments(trace_dir, files_for_openai)
            except Exception as e:
                logger.warning(f"[trace] Error guardando input: {e}")

        logger.info(
            f"[minutes] Llamando a OpenAI | model={settings.openai_model} "
            f"archivos={len(files_for_openai)}"
        )

        ai_output = _call_openai(prompt_system, files_for_openai, ai_input, trace_dir)

        # Guardar output crudo ANTES de validar — si la estructura es inválida
        # igual queremos tenerlo en el trace para debugging.
        if trace_dir:
            try:
                _save_trace_output(trace_dir, ai_output, "pending_validation")
            except Exception as e:
                logger.warning(f"[trace] Error guardando output crudo: {e}")

        # Validar estructura mínima del output.
        # El schema del prompt define scope.sections (no sections en top-level).
        required_top   = ["scope", "agreements", "requirements", "upcomingMeetings"]
        missing_top    = [k for k in required_top if k not in ai_output]
        missing_scope  = [] if "scope" not in ai_output else (
            ["scope.sections"] if "sections" not in ai_output.get("scope", {}) else []
        )
        missing = missing_top + missing_scope

        if missing:
            logger.error(
                f"[minutes] Output de IA con estructura inválida | "
                f"claves_recibidas={list(ai_output.keys())} | "
                f"faltantes={missing}"
            )
            raise RuntimeError(
                f"Respuesta de IA incompleta. Claves faltantes: {missing}"
            )

        sections = ai_output["scope"].get("sections", [])
        # El schema usa content.topicsList, no topics directamente
        topics = [t for s in sections for t in s.get("content", {}).get("topicsList", [])]

        if isinstance(ai_output.get("metadata"), dict):
            ai_output["metadata"]["generatedAt"] = _now_utc().strftime("%Y-%m-%dT%H:%M:%SZ")

        logger.info(
            f"[minutes] Respuesta válida — "
            f"{len(sections)} secciones | {len(topics)} topics | "
            f"acuerdos={len(ai_output['agreements']['items'])} | "
            f"reqs={len(ai_output['requirements']['items'])} | "
            f"próximas={len(ai_output['upcomingMeetings']['items'])}"
        )

        if trace_dir:
            try:
                _save_trace_output(trace_dir, ai_output, "valid")
            except Exception as e:
                logger.warning(f"[trace] Error actualizando trace a valid: {e}")

    except openai.RateLimitError as e:
        logger.error(f"[minutes] Rate limit OpenAI: {e}")
        if trace_dir:
            _finalize_trace(trace_dir, "failed", str(e))
        db.rollback()
        _commit_failed_state(db, tx, "Límite de cuota de IA excedido.", transaction_id, record_id)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error":          "rate_limit_exceeded",
                "message":        "Límite de cuota de IA excedido. Intenta más tarde.",
                "transaction_id": transaction_id,
                "record_id":      record_id,
            },
        )

    except openai.BadRequestError as e:
        logger.error(f"[minutes] Bad request OpenAI: {e}")
        if trace_dir:
            _finalize_trace(trace_dir, "failed", str(e))
        db.rollback()
        _commit_failed_state(db, tx, f"Error en solicitud a IA: {str(e)}", transaction_id, record_id)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error":          "invalid_ai_request",
                "message":        "Solicitud rechazada por la IA. Verifica los archivos.",
                "transaction_id": transaction_id,
                "record_id":      record_id,
            },
        )

    except openai.AuthenticationError as e:
        logger.error(f"[minutes] Auth error OpenAI: {e}")
        if trace_dir:
            _finalize_trace(trace_dir, "failed", str(e))
        db.rollback()
        _commit_failed_state(db, tx, "Error de configuración del servicio de IA", transaction_id, record_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error":          "ai_auth_error",
                "message":        "Error de configuración de IA. Contacta al administrador.",
                "transaction_id": transaction_id,
                "record_id":      record_id,
            },
        )

    except openai.APITimeoutError as e:
        logger.error(f"[minutes] Timeout OpenAI: {e}")
        if trace_dir:
            _finalize_trace(trace_dir, "failed", str(e))
        db.rollback()
        _commit_failed_state(db, tx, "Tiempo de espera agotado", transaction_id, record_id)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "error":          "ai_timeout",
                "message":        "La IA tardó demasiado. Intenta nuevamente.",
                "transaction_id": transaction_id,
                "record_id":      record_id,
            },
        )

    except openai.APIError as e:
        logger.error(f"[minutes] API error OpenAI: {e}")
        if trace_dir:
            _finalize_trace(trace_dir, "failed", str(e))
        db.rollback()
        _commit_failed_state(db, tx, "Error interno del servicio de IA", transaction_id, record_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error":          "ai_service_error",
                "message":        "Servicio de IA no disponible. Intenta más tarde.",
                "transaction_id": transaction_id,
                "record_id":      record_id,
            },
        )

    except ValueError as e:
        logger.error(f"[minutes] Validación: {e}")
        if trace_dir:
            _finalize_trace(trace_dir, "failed", str(e))
        db.rollback()
        _commit_failed_state(db, tx, str(e), transaction_id, record_id)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error":          "validation_error",
                "message":        str(e),
                "transaction_id": transaction_id,
                "record_id":      record_id,
            },
        )

    except Exception as e:
        logger.error(f"[minutes] Error inesperado: {e}", exc_info=True)
        if trace_dir:
            _finalize_trace(trace_dir, "failed", str(e))
        db.rollback()
        _commit_failed_state(db, tx, f"Error inesperado: {str(e)}", transaction_id, record_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error":          "unexpected_error",
                "message":        "Error inesperado al procesar la minuta.",
                "transaction_id": transaction_id,
                "record_id":      record_id,
            },
        )

    # ── A partir de aquí ai_output está garantizado ───────────────────────────

    # ── 6. Guardar LLM output JSON en MinIO ───────────────────────────────────
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

    artefacto_llm = _build_artifact_row(
        record_id         = record_id,
        artifact_type_id  = art_llm_orig_id,
        artifact_state_id = state_original_id,
        object_id         = ai_output_obj_id,
        created_by        = requested_by_id,
        record_version_id = None,
        is_draft          = False,
        natural_name      = "llm_output_v1.json",
    )
    artefactos_output.append(artefacto_llm)

    # ── 7. Canonical JSON (copia editable) ────────────────────────────────────
    canonical_key    = f"{record_id}/schema_output_v1.json"
    canonical_obj_id = str(uuid.uuid4())

    minio.put_object(
        bucket_name  = BUCKET_JSON,
        object_name  = canonical_key,
        data         = io.BytesIO(ai_output_bytes),
        length       = len(ai_output_bytes),
        content_type = "application/json",
    )

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

    artefacto_canonical = _build_artifact_row(
        record_id         = record_id,
        artifact_type_id  = art_canonical_id,
        artifact_state_id = state_ready_id,
        object_id         = canonical_obj_id,
        created_by        = requested_by_id,
        record_version_id = None,
        is_draft          = True,   # ← Borrador, requiere record_draft vigente
        natural_name      = "schema_output_v1.json",
    )
    artefactos_output.append(artefacto_canonical)

    # ── 8. Crear RecordVersion v1 + RecordDraft ───────────────────────────────
    #
    # ORDEN CRÍTICO:
    #   - Los artefactos (input y output) NO se agregan a la sesión todavía.
    #   - db.flush() aquí solo ve: version, draft, Objects → los persiste.
    #   - Luego asignamos version_id y hacemos db.add() de todos los artefactos.
    #   - Los artefactos de input se crean aquí (no en TX1) porque el trigger
    #     exige record_version_id en artefactos publicados (is_draft=0).
    #   - db.flush([...artefactos]) los inserta con todas las FKs satisfechas.

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

    # Requerido por trigger para artefactos con is_draft=True
    draft = RecordDraft(
        record_id  = record_id,
        created_by = requested_by_id,
    )
    db.add(draft)

    # 8a: flush — persiste version + draft + todos los Objects pendientes de TX2
    #     Los artefactos NO están en la sesión todavía → trigger no se dispara
    db.flush()

    # 8b: crear artefactos de INPUT ahora que tenemos version_id
    #     (no podían crearse en TX1 porque el trigger requiere record_version_id)
    artefactos_input = []
    for meta in input_objects_meta:
        art_input = _build_artifact_row(
            record_id         = record_id,
            artifact_type_id  = meta["art_type_id"],
            artifact_state_id = state_original_id,
            object_id         = meta["obj_id"],
            created_by        = requested_by_id,
            record_version_id = version_id,
            is_draft          = False,
            natural_name      = meta["fname"],
        )
        artefactos_input.append(art_input)
        db.add(art_input)

    # 8c: asignar version_id y agregar artefactos de OUTPUT a la sesión
    for art in artefactos_output:
        if not art.is_draft:
            art.record_version_id = version_id
        db.add(art)

    logger.info(
        f"[minutes] Versión {version_id} | RecordDraft {record_id} creados | "
        f"artefactos input={len(artefactos_input)} output={len(artefactos_output)}"
    )

    # 8d: flush de todos los artefactos (triggers satisfechos: todos tienen version_id o is_draft)
    todos_artefactos = artefactos_input + artefactos_output
    db.flush(todos_artefactos)

    # ── 9. TX2 COMMIT FINAL ───────────────────────────────────────────────────
    tx.status           = "completed"
    tx.completed_at     = _now_utc()
    tx.record_version_id = version_id

    record.active_version_id  = version_id
    record.latest_version_num = 1

    db.commit()

    logger.info(f"[minutes] TX2 commiteada — procesamiento completado | record={record_id} version={version_id}")

    # ── Finalizar trazabilidad ────────────────────────────────────────────────
    if trace_dir:
        try:
            _finalize_trace(trace_dir, "completed")
            logger.info(f"[trace] Trazabilidad completa en: {trace_dir}")
        except Exception as e:
            logger.warning(f"[trace] Error finalizando trace: {e}")

    logger.info(f"[minutes] Minuta generada exitosamente | record={record_id} version={version_id}")

    return MinuteGenerateResponse(
        transaction_id = transaction_id,
        record_id      = record_id,
        status         = "completed",
        message        = "Minuta generada exitosamente",
    )


# ─── Status ──────────────────────────────────────────────────────────────────

async def get_minute_status(
    db:             Session,
    transaction_id: str,
) -> MinuteStatusResponse:
    tx = db.query(MinuteTransaction).filter_by(id=transaction_id).first()
    if tx is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction no encontrada",
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
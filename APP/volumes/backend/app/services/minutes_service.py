# services/minutes_service.py
"""
Servicio de generación de minutas.

Flujo:
  1. Resolver IDs de catálogo desde BD
  2. Crear Record (status_id=ACCEPTED) + MinuteTransaction (pending)
  3. Leer archivos y subir a MinIO → minuetaitor-inputs/{record_id}/
  4. Registrar Objects + RecordArtifacts de entrada en BD
  5. Construir AI input schema
  6. Llamar a OpenAI (base64 inline en Chat Completions)
  7. Guardar output JSON en MinIO → minuetaitor-json/{record_id}/
  8. Registrar Objects + RecordArtifacts de salida en BD
  9. Crear RecordVersion v1 + RecordDraft
  10. Actualizar Record (active_version_id) + MinuteTransaction (completed)
  11. Retornar MinuteGenerateResponse

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
            return _sha256_bytes(file_content)  # ← Reutilizando la función existente
            
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
        prompt = prompt.replace("{userTags}",           user_tags or "Sin tags proporcionados.")

        logger.debug(f"[minutes] Prompt cargado desde {PROMPT_FILE} | perfil='{profile_name}'")
        return prompt

    logger.warning(f"[minutes] {PROMPT_FILE} no encontrado en {prompt_path} — usando prompt fallback")
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


# ─── Resolución y validación de MIME ─────────────────────────────────────────

def _resolve_mime(fname: str, declared_mime: str) -> str:
    """
    Resuelve el MIME type efectivo para un archivo.

    Prioridad:
      1. Extensión del nombre del archivo  (más confiable — curl/browsers mienten)
      2. MIME declarado por el cliente, normalizado
      3. Inferencia con mimetypes stdlib
      4. Devuelve el declarado para que la validación posterior lo rechace

    Las listas de referencia se leen desde settings para que sean
    configurables sin tocar el código.
    """
    ext = Path(fname).suffix.lower()

    # 1. Extensión
    if ext in settings.minutes_supported_extensions:
        return settings.minutes_supported_extensions[ext]

    # 2. MIME declarado (ignorar parámetros como "; charset=utf-8")
    mime_base = declared_mime.split(";")[0].strip().lower()
    if mime_base in settings.minutes_supported_mimes:
        return settings.minutes_supported_mimes[mime_base]

    # 3. Inferencia
    guessed, _ = mimetypes.guess_type(fname)
    if guessed and guessed in settings.minutes_supported_mimes:
        return guessed

    # 4. No resolvible — devolver para que _validate_file_mime lo rechace
    return mime_base


def _validate_file_mime(fname: str, resolved_mime: str) -> None:
    """
    Lanza ValueError si el MIME no está en la lista de soportados.
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
        "received_at":       _now_utc().isoformat(),  # ← UTC consistente con el resto
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
        meta["status"]       = final_status
        meta["finalized_at"] = datetime.now().isoformat()
        if error:
            meta["error"] = error
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"[trace] No se pudo finalizar meta.json: {e}")


# ─── OpenAI ──────────────────────────────────────────────────────────────────

async def _call_openai(
    ai_input:      dict,
    files_bytes:   list[tuple[str, bytes, str]],
    prompt_system: str,
) -> dict:
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    supports_files = _model_supports_file_blocks(settings.openai_model)
    logger.debug(
        f"[openai] Modelo='{settings.openai_model}' | "
        f"file_blocks={'sí' if supports_files else 'no (fallback texto)'}"
    )

    # ── Construir content ─────────────────────────────────────────────────────
    if supports_files:
        content_blocks: list[dict] = [
            {
                "type": "text",
                "text": (
                    "Procesa la siguiente reunión y genera la minuta estructurada en JSON.\n\n"
                    f"METADATA DE LA SOLICITUD:\n"
                    f"{json.dumps(ai_input, ensure_ascii=False, indent=2)}"
                ),
            }
        ]

        for fname, raw, declared_mime in files_bytes:
            resolved_mime = _resolve_mime(fname, declared_mime)
            _validate_file_mime(fname, resolved_mime)

            if resolved_mime == "application/pdf":
                b64 = base64.b64encode(raw).decode("utf-8")
                content_blocks.append({
                    "type": "file",
                    "file": {
                        "filename":  fname,
                        "file_data": f"data:{resolved_mime};base64,{b64}",
                    },
                })
                logger.info(f"[openai] Adjunto PDF base64: {fname} | {len(raw):,} bytes")
            else:
                try:
                    text = raw.decode("utf-8")
                except UnicodeDecodeError:
                    text = raw.decode("latin-1", errors="replace")
                content_blocks.append({
                    "type": "text",
                    "text": f"--- ARCHIVO: {fname} ---\n{text}",
                })
                logger.info(f"[openai] Adjunto texto: {fname} | {len(raw):,} bytes")

        user_message_content = content_blocks

    else:
        files_text = ""
        for fname, raw, declared_mime in files_bytes:
            resolved_mime = _resolve_mime(fname, declared_mime)

            if resolved_mime == "application/pdf":
                raise ValueError(
                    f"El modelo '{settings.openai_model}' no soporta archivos PDF. "
                    f"Cambia a gpt-4o o gpt-4.1, o convierte el PDF a texto antes de subirlo."
                )

            _validate_file_mime(fname, resolved_mime)

            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                text = raw.decode("latin-1", errors="replace")

            files_text += f"\n\n--- ARCHIVO: {fname} ---\n{text}"
            logger.info(f"[openai] Adjunto texto plano: {fname} | {len(raw):,} bytes")

        logger.warning(
            f"[openai] Modelo '{settings.openai_model}' sin soporte file blocks. "
            f"Usando fallback texto plano."
        )
        user_message_content = (
            "Procesa la siguiente reunión y genera la minuta estructurada en JSON.\n\n"
            f"METADATA DE LA SOLICITUD:\n"
            f"{json.dumps(ai_input, ensure_ascii=False, indent=2)}"
            f"{files_text}"
        )

    messages = [
        {"role": "system", "content": prompt_system},
        {"role": "user",   "content": user_message_content},
    ]

    # ── Llamada al modelo con reintento si se alcanza el límite de tokens ─────
    async def _invoke(max_tokens: int) -> tuple[str, str]:
        response = await client.chat.completions.create(
            model           = settings.openai_model,
            messages        = messages,
            response_format = {"type": "json_object"},
            temperature     = settings.openai_temperature,
            max_tokens      = max_tokens,
            top_p           = settings.openai_top_p,
            seed            = settings.openai_seed,
            timeout         = settings.openai_timeout_seconds,
        )
        return (
            response.choices[0].message.content or "{}",
            response.choices[0].finish_reason or "stop",
        )

    # Intento 1 — límite base (normal)
    raw_text, finish_reason = await _invoke(settings.openai_max_tokens)
    logger.debug(
        f"[openai] Intento 1 finish_reason={finish_reason} | "
        f"max_tokens={settings.openai_max_tokens}"
    )

    # Intento 2 — reintento automático si se alcanzó el límite
    if finish_reason == "length":
        retry_limit = settings.openai_max_tokens_retry
        logger.warning(
            f"[openai] Output cortado (finish_reason=length) con {settings.openai_max_tokens} tokens. "
            f"Reintentando con {retry_limit} tokens..."
        )
        raw_text, finish_reason = await _invoke(retry_limit)
        logger.debug(
            f"[openai] Intento 2 finish_reason={finish_reason} | "
            f"max_tokens={retry_limit}"
        )

        if finish_reason == "length":
            logger.error(
                f"[openai] Output cortado incluso con {retry_limit} tokens. "
                f"La sesión excede la capacidad máxima de procesamiento."
            )
            raise ValueError(
                "La sesión es demasiado extensa para procesarse en un solo archivo. "
                "Te recomendamos dividirla en dos partes (por ejemplo, primera y segunda mitad) "
                "y generar una minuta por cada parte."
            )

    # ── Parsear JSON ──────────────────────────────────────────────────────────
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(f"[openai] Output no es JSON válido: {e}\nRaw: {raw_text[:500]}")
        raise RuntimeError(f"La IA retornó un JSON inválido: {e}")
    
# ─── Limpieza MinIO ───────────────────────────────────────────────────────────

async def _cleanup_minio_files(minio, record_id: str, file_metadata: list[dict]):
    if not file_metadata:
        return

    logger.info(f"[minutes] Limpiando {len(file_metadata)} archivos de MinIO para record {record_id}")
    eliminados = 0

    for meta in file_metadata:
        try:
            minio.remove_object(BUCKET_INPUTS, f"{record_id}/{meta['fileName']}")
            eliminados += 1
        except Exception as e:
            logger.warning(f"[minutes] Error limpiando {meta.get('fileName')}: {e}")

    logger.info(f"[minutes] Limpieza MinIO: {eliminados}/{len(file_metadata)} eliminados")


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
    artefactos_creados: list[RecordArtifact] = []
    file_metadata:      list[dict]           = []
    trace_dir:          Optional[str]        = None

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

    # ── Resolver client_id ────────────────────────────────────────────────────
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
    minio = get_minio_client()
    input_object_id: Optional[str] = None

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
        artefactos_creados.append(artefacto)

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

    # ── 4. Llamar a OpenAI ────────────────────────────────────────────────────
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

        # ── Trazabilidad ANTES de llamar al modelo ────────────────────────
        # Si el modelo falla, el input ya está guardado para debugging.
        if trace_dir:
            try:
                _save_trace_attachments(trace_dir, files_for_openai)
                _save_trace_input(trace_dir, ai_input, prompt_system)
            except Exception as e:
                logger.warning(f"[trace] Error guardando input/adjuntos: {e}")

        # ── Llamar al modelo ──────────────────────────────────────────────
        ai_output = await _call_openai(
            ai_input      = ai_input,
            files_bytes   = files_for_openai,
            prompt_system = prompt_system,
        )

        # ── Validar respuesta ─────────────────────────────────────────────
        if not isinstance(ai_output, dict):
            if trace_dir:
                _save_trace_output(trace_dir, {}, "error_not_dict")
            raise ValueError("OpenAI no retornó un objeto JSON válido")

        # scope.sections debe existir y ser lista no vacía
        sections = ai_output.get("scope", {}).get("sections")
        if not isinstance(sections, list) or len(sections) == 0:
            if trace_dir:
                _save_trace_output(trace_dir, ai_output, "error_scope_sections_missing")
            raise ValueError("La respuesta no contiene 'scope.sections' o está vacía")

        # La primera sección debe ser introduction con content.summary
        intro = sections[0]
        if not isinstance(intro, dict) or intro.get("sectionType") != "introduction":
            if trace_dir:
                _save_trace_output(trace_dir, ai_output, "error_introduction_missing")
            raise ValueError("La primera sección de 'scope.sections' debe ser de tipo 'introduction'")

        if not isinstance(intro.get("content"), dict) or not intro["content"].get("summary"):
            if trace_dir:
                _save_trace_output(trace_dir, ai_output, "error_introduction_structure")
            raise ValueError("La sección 'introduction' debe contener 'content.summary'")

        # Debe haber al menos un topic
        topics = [s for s in sections if isinstance(s, dict) and s.get("sectionType") == "topic"]
        if len(topics) == 0:
            if trace_dir:
                _save_trace_output(trace_dir, ai_output, "error_no_topics")
            raise ValueError("La respuesta debe contener al menos una sección de tipo 'topic'")

        # Normalizar secciones opcionales
        for key in ("agreements", "requirements", "upcomingMeetings"):
            section = ai_output.get(key)
            if not isinstance(section, dict):
                logger.warning(f"[minutes] '{key}' ausente o inválido — se inicializa vacío")
                ai_output[key] = {"items": []}
            elif not isinstance(section.get("items"), list):
                logger.warning(f"[minutes] '{key}.items' no es lista — se normaliza a []")
                ai_output[key]["items"] = []


        # ── Sobrescribir generatedAt con timestamp real del servidor ──────────────
        # El modelo no tiene acceso al reloj — siempre genera fechas incorrectas.
        if isinstance(ai_output.get("metadata"), dict):
            ai_output["metadata"]["generatedAt"] = _now_utc().strftime("%Y-%m-%dT%H:%M:%SZ")

        logger.info(
            f"[minutes] Respuesta válida — "
            f"{len(sections)} secciones ({len(topics)} topics) | "
            f"acuerdos={len(ai_output['agreements']['items'])} | "
            f"reqs={len(ai_output['requirements']['items'])} | "
            f"próximas={len(ai_output['upcomingMeetings']['items'])}"
        )

        if trace_dir:
            try:
                _save_trace_output(trace_dir, ai_output, "valid")
            except Exception as e:
                logger.warning(f"[trace] Error guardando output: {e}")

    except openai.RateLimitError as e:
        logger.error(f"[minutes] Rate limit OpenAI: {e}")
        if trace_dir:
            _finalize_trace(trace_dir, "failed", str(e))
        tx.status        = "failed"
        tx.error_message = "Límite de cuota de IA excedido."
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
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
        tx.status        = "failed"
        tx.error_message = f"Error en solicitud a IA: {str(e)}"
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
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
        tx.status        = "failed"
        tx.error_message = "Error de configuración del servicio de IA"
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
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
        tx.status        = "failed"
        tx.error_message = "Tiempo de espera agotado"
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
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
        tx.status        = "failed"
        tx.error_message = "Error interno del servicio de IA"
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
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
        tx.status        = "failed"
        tx.error_message = str(e)
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
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
        tx.status        = "failed"
        tx.error_message = f"Error inesperado: {str(e)}"
        db.rollback()
        await _cleanup_minio_files(minio, record_id, file_metadata)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error":          "unexpected_error",
                "message":        "Error inesperado al procesar la minuta.",
                "transaction_id": transaction_id,
                "record_id":      record_id,
            },
        )

    # ── 5. Guardar LLM output JSON en MinIO ───────────────────────────────────
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
    artefactos_creados.append(artefacto_llm)

    # ── 6. Canonical JSON (copia editable) ────────────────────────────────────
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
    artefactos_creados.append(artefacto_canonical)

    # ── 7. Crear RecordVersion v1 + RecordDraft ───────────────────────────────
    #
    # ORDEN CRÍTICO:
    #   - Los artefactos NO se agregaron a la sesión en los pasos 3/5/6
    #   - db.flush() aquí solo ve: version, draft, Objects → los persiste
    #   - Luego asignamos version_id y hacemos db.add() de los artefactos
    #   - db.flush(artefactos_creados) los inserta con todo satisfecho

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

    # 7a: flush — persiste version + draft + todos los Objects pendientes
    #     Los artefactos NO están en la sesión todavía → trigger no se dispara
    db.flush()

    # 7b: asignar version_id y agregar artefactos a la sesión recién ahora
    for art in artefactos_creados:
        if not art.is_draft:
            art.record_version_id = version_id
        db.add(art)

    logger.info(f"[minutes] Versión {version_id} | RecordDraft {record_id} creados")

    # 7c: flush de artefactos (recién en sesión, triggers satisfechos)
    db.flush(artefactos_creados)
    
    # ── 8. ¡¡¡COMMIT FINAL!!! ─────────────────────────────────────────────────
    # Este es el paso crítico que faltaba - confirma todos los cambios en la BD
    tx.status = "completed"
    tx.completed_at = _now_utc()
    db.commit()
    
    logger.info(f"[minutes] Transacción {transaction_id} completada y commiteada")

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
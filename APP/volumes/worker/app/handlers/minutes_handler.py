# handlers/minutes_handler.py
"""
Handler de jobs de tipo 'minutes' — TX2 del pipeline.

Responsabilidades:
  1. Descargar archivos de entrada desde MinIO
  2. Llamar a OpenAI con el prompt y los archivos
  3. Volcar archivos de debug en /app/assets/temp  (si TRACE_ENABLED=true)
  4. Enviar resultado al backend via POST /internal/v1/minutes/commit
  5. Publicar evento Redis Pub/Sub (failed) si el backend no pudo hacerlo

Lo que este handler NO hace:
  - Acceder a la base de datos directamente
  - Importar modelos SQLAlchemy
  - Aplicar reglas de negocio de persistencia

Claves del payload (enviadas por el backend en TX1):
  file_metadata[]:      { fileName, mimeType, sha256, fileType }
  input_objects_meta[]: { obj_id, art_type_id, fname }
  ai_profile:           { profile_id, profile_name, profile_description, profile_prompt }
  catalog_ids:          { version_status_id, bucket_json_id, art_llm_orig_id,
                          art_canonical_id, state_original_id, state_ready_id }
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
import uuid
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any

import openai
from minio import Minio

from core.backend_client import (
    BackendClientError,
    commit_tx2,
    get_active_ai_provider_config,
    report_minute_failure,
)
from core.config import settings
from core.job import JobEnvelope
from core.logging_config import get_logger
from core.redis_client import get_redis

logger = get_logger("worker.handler.minutes")

# ── Constantes MinIO ──────────────────────────────────────────────────────────
BUCKET_INPUTS  = "minuetaitor-inputs"
PUBSUB_CHANNEL = settings.PUBSUB_MINUTES_CHANNEL

# ── Lazy-init MinIO ───────────────────────────────────────────────────────────
_minio_client = None


class NonRetryableMinuteError(RuntimeError):
    """
    Error terminal del pipeline de minutas.

    Se usa cuando el worker detecta una condición que no mejorará con
    reintentos automáticos.
    """
    def __init__(self, message: str, *, record_status: str = "processing-error"):
        super().__init__(message)
        self.record_status = str(record_status or "processing-error").strip() or "processing-error"


def _get_minio() -> Minio:
    global _minio_client
    if _minio_client is None:
        _minio_client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_USER,
            secret_key=settings.MINIO_PASSWORD,
            secure=settings.MINIO_SECURE,
        )
    return _minio_client


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _parse_clock_time(value: str | None) -> time | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%H:%M").time()
    except ValueError:
        return None


def _format_clock_time(value: time) -> str:
    return value.strftime("%H:%M")


def _extract_last_transcript_offset_seconds(files: list[dict]) -> int | None:
    """
    Busca el último timestamp relativo de la transcripción.

    Soporta formatos típicos:
      [MM:SS]
      [HH:MM:SS]
    """
    pattern = re.compile(r"\[(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\]")
    max_seconds: int | None = None

    for file in files:
        file_name = str(file.get("fileName") or "").lower()
        if "transcrip" not in file_name and "transcript" not in file_name:
            continue

        raw = file.get("content", b"")
        if isinstance(raw, bytes):
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                text = raw.decode("latin-1", errors="replace")
        else:
            text = str(raw)

        for match in pattern.finditer(text):
            hours = int(match.group(1) or 0)
            minutes = int(match.group(2))
            seconds = int(match.group(3))
            total_seconds = (hours * 3600) + (minutes * 60) + seconds
            if max_seconds is None or total_seconds > max_seconds:
                max_seconds = total_seconds

    return max_seconds


def _infer_actual_end_time(ai_input: dict, files: list[dict]) -> str | None:
    meeting_info = ai_input.get("meetingInfo") if isinstance(ai_input, dict) else {}
    if not isinstance(meeting_info, dict):
        return None

    base_time = (
        _parse_clock_time(meeting_info.get("actualStartTime"))
        or _parse_clock_time(meeting_info.get("scheduledStartTime"))
    )
    offset_seconds = _extract_last_transcript_offset_seconds(files)
    if not base_time or offset_seconds is None:
        return None

    base_dt = datetime.combine(datetime(2000, 1, 1), base_time)
    inferred_dt = base_dt + timedelta(seconds=offset_seconds)
    rounded_dt = inferred_dt + timedelta(seconds=30)
    return _format_clock_time(rounded_dt.time())


# ── TRACE: volcado de archivos de debug ───────────────────────────────────────

def _trace_write(
    tx_id: str,
    prompt: str,
    ai_input: dict,
    ai_output: dict,
    files: list[dict],
    tokens_in: int,
    tokens_out: int,
    ai_provider: str,
    ai_model: str,
    run_id: str,
) -> None:
    """
    Vuelca los artefactos de debug en /app/assets/temp/<tx_id>/ si TRACE_ENABLED=true.

    Estructura generada:
        /app/assets/temp/<tx_id>/
            prompt.txt          <- system prompt completo
            input.json          <- ai_input_schema enviado a OpenAI
            output.json         <- respuesta JSON de OpenAI
            meta.json           <- tokens, run_id, modelo, timestamp
            attachments/
                <fileName>      <- archivos enviados para analisis
    """
    if not getattr(settings, "TRACE_ENABLED", False):
        return

    try:
        base    = Path(getattr(settings, "TRACE_BASE_DIR", "/app/assets/temp")) / tx_id
        att_dir = base / "attachments"
        base.mkdir(parents=True, exist_ok=True)
        att_dir.mkdir(exist_ok=True)

        (base / "prompt.txt").write_text(prompt, encoding="utf-8")

        (base / "input.json").write_text(
            json.dumps(ai_input, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (base / "output.json").write_text(
            json.dumps(ai_output, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        meta = {
            "transaction_id": tx_id,
            "ai_provider":    ai_provider,
            "ai_model":       ai_model,
            "openai_run_id":  run_id,
            "tokens_input":   tokens_in,
            "tokens_output":  tokens_out,
            "timestamp_utc":  _now_utc().isoformat(),
            "model":          ai_model,
        }
        (base / "meta.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        # Guardar attachments — cada dict tiene { fileName, content (bytes) }
        for f in files:
            fname   = f.get("fileName", f"file_{uuid.uuid4().hex[:8]}.txt")  # <- fileName
            content = f.get("content", b"")
            if isinstance(content, str):
                content = content.encode("utf-8")
            (att_dir / fname).write_bytes(content)

        logger.info("TRACE escrito | dir=%s", base)

    except Exception as e:
        # El trace nunca debe interrumpir el flujo principal
        logger.warning("Error escribiendo TRACE (ignorado): %s", e)


# ── Descarga de archivos desde MinIO ─────────────────────────────────────────

def _download_files_from_minio(
    minio: Minio,
    rec_id: str,
    file_metadata: list[dict],
) -> list[dict]:
    """
    Descarga los archivos de entrada desde MinIO.

    Cada elemento de file_metadata viene del backend con:
        { fileName, mimeType, sha256, fileType }

    Retorna lista de dicts con { fileName, content (bytes), mimeType, size }.
    """
    files = []
    for meta in file_metadata:
        fname   = meta["fileName"]           # <- fileName (camelCase, como envía el backend)
        mime    = meta.get("mimeType", "text/plain")
        obj_key = meta.get("objKey") or f"{rec_id}/{fname}"

        try:
            resp = minio.get_object(BUCKET_INPUTS, obj_key)
            data = resp.read()
            resp.close()
            resp.release_conn()
            files.append({
                "fileName": fname,   # <- consistente en todo el handler
                "content":  data,
                "mimeType": mime,
                "size":     len(data),
            })
            logger.info("Archivo descargado: %s (%d bytes)", fname, len(data))
        except Exception as e:
            logger.error("Error descargando %s: %s", obj_key, e)
            raise RuntimeError(f"No se pudo descargar {fname} desde MinIO: {e}")

    return files


# ── Carga del prompt ──────────────────────────────────────────────────────────

def _load_agent_prompt(ai_profile: dict, additional_notes: str = "") -> str:
    """
    Carga el system prompt desde archivo y sustituye variables del perfil.

    ai_profile viene del backend con:
        { profile_id, profile_name, profile_description, profile_prompt }
    """
    prompt_path = Path(settings.PROMPT_PATH_BASE) / settings.OPENAI_SYSTEM_PROMPT

    if prompt_path.exists():
        tmpl = prompt_path.read_text(encoding="utf-8")
        logger.info("Prompt cargado: %s", prompt_path)
    else:
        logger.warning("Archivo de prompt no encontrado: %s — usando fallback", prompt_path)
        tmpl = (
            "Eres un asistente experto en generar minutas de reuniones estructuradas. "
            "Analiza la transcripcion y el resumen proporcionados y genera una minuta "
            "completa en formato JSON segun el esquema especificado.\n\n"
            "Perfil: {profileName}\n"
            "Descripcion: {profileDescription}\n"
            "Instrucciones especificas: {profilePrompt}\n"
            "Notas adicionales: {additionalNotes}"
        )

    # Sustitucion de variables del perfil
    # <- claves snake_case, como vienen en ai_profile del backend
    tmpl = tmpl.replace("{profileId}",          ai_profile.get("profile_id",          ""))
    tmpl = tmpl.replace("{profileName}",         ai_profile.get("profile_name",         ""))
    tmpl = tmpl.replace("{profileDescription}",  ai_profile.get("profile_description",  ""))
    tmpl = tmpl.replace("{profilePrompt}",       ai_profile.get("profile_prompt",       "") or "Analiza la reunion.")
    tmpl = tmpl.replace("{additionalNotes}",     additional_notes or "Sin notas adicionales.")
    tmpl = tmpl.replace("{userTags}",            "Sin etiquetas.")

    return tmpl


# ── Resolución de proveedor runtime ──────────────────────────────────────────

def _resolve_runtime_ai_provider() -> dict[str, Any]:
    provider = get_active_ai_provider_config()
    provider_type = str(provider.get("provider_type") or "").strip()
    provider_family = str(provider.get("provider_family") or "").strip() or "generic"
    model_name = str(provider.get("model_name") or "").strip()
    auth_type = str(provider.get("auth_type") or "").strip() or "none"
    base_url = str(provider.get("base_url") or "").strip()
    timeout_seconds = int(provider.get("timeout_seconds") or settings.AI_PROVIDER_TIMEOUT_FALLBACK)
    token = str(provider.get("token") or "").strip() or None

    if not provider_type:
        raise NonRetryableMinuteError("La configuración AI activa no informó un provider_type válido")
    if not model_name:
        raise NonRetryableMinuteError("La configuración AI activa no informó un modelo válido")
    if not base_url:
        raise NonRetryableMinuteError("La configuración AI activa no informó una base_url válida")
    if provider_family != "openai_compatible":
        raise NonRetryableMinuteError(
            f"La familia de proveedor '{provider_family}' aún no está soportada por el worker de minutas. "
            "Por ahora solo se admite 'openai_compatible'."
        )
    if auth_type not in {"api_key", "none"}:
        raise NonRetryableMinuteError(
            f"El auth_type '{auth_type}' aún no está soportado por el worker de minutas para proveedores openai_compatible."
        )
    if auth_type == "api_key" and not token:
        raise NonRetryableMinuteError("La configuración AI activa requiere token/API key, pero no entregó credencial usable")

    return {
        "provider_type": provider_type,
        "provider_family": provider_family,
        "model_name": model_name,
        "auth_type": auth_type,
        "base_url": base_url.rstrip("/"),
        "timeout_seconds": timeout_seconds if timeout_seconds > 0 else settings.AI_PROVIDER_TIMEOUT_FALLBACK,
        "token": token,
        "custom_headers": provider.get("custom_headers") or {},
    }


# ── Llamada a proveedor IA ───────────────────────────────────────────────────

def _call_openai_sync(
    provider_config: dict[str, Any],
    prompt: str,
    files: list[dict],
    ai_input: dict,
) -> tuple[dict, str, int, int]:
    """
    Llama al proveedor IA compatible con OpenAI de forma sincrona.

    files: lista de { fileName, content (bytes), mimeType }
    Retorna (parsed_output, run_id, tokens_in, tokens_out).
    """
    extra_headers = provider_config.get("custom_headers") or {}
    if extra_headers:
        logger.warning(
            "La configuración AI activa incluye custom_headers; el worker actual no los aplica en el cliente openai_compatible"
        )

    client = openai.OpenAI(
        api_key=provider_config.get("token") or "not-needed",
        base_url=provider_config["base_url"],
        timeout=provider_config["timeout_seconds"],
    )

    content_parts: list[Any] = []

    # Schema de entrada como contexto
    content_parts.append({
        "type": "text",
        "text": (
            "# Contexto de la reunion\n"
            f"```json\n{json.dumps(ai_input, ensure_ascii=False, indent=2)}\n```"
        ),
    })

    # Archivos como texto inline
    for f in files:
        raw = f["content"]   # bytes
        try:
            text = raw.decode("utf-8") if isinstance(raw, bytes) else raw
        except UnicodeDecodeError:
            text = raw.decode("latin-1", errors="replace")

        # <- clave correcta: 'fileName' (camelCase)
        content_parts.append({
            "type": "text",
            "text": f"# Archivo: {f['fileName']}\n\n{text}",
        })

    total_chars = sum(len(str(p)) for p in content_parts)
    logger.info(
        "Llamando a proveedor IA | provider=%s model=%s archivos=%d partes=%d chars~%d",
        provider_config["provider_type"], provider_config["model_name"], len(files), len(content_parts), total_chars,
    )

    try:
        resp = client.chat.completions.create(
            model=provider_config["model_name"],
            max_tokens=settings.AI_MAX_TOKENS,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user",   "content": content_parts},
            ],
            response_format={"type": "json_object"},
        )
    except Exception as e:
        logger.error("Error en llamada a OpenAI: %s", e)
        raise

    raw_text = resp.choices[0].message.content or ""

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error("JSON invalido de OpenAI: %s...", raw_text[:200])
        raise NonRetryableMinuteError(f"IA retornó JSON inválido: {e}", record_status="llm-failed")

    # Validar estructura minima esperada
    required = ["scope", "agreements", "requirements", "upcomingMeetings"]
    missing  = [k for k in required if k not in parsed]
    if missing:
        raise NonRetryableMinuteError(
            f"Respuesta de IA incompleta. Faltantes: {missing}",
            record_status="llm-failed",
        )

    usage      = resp.usage
    tokens_in  = getattr(usage, "prompt_tokens",     0) if usage else 0
    tokens_out = getattr(usage, "completion_tokens", 0) if usage else 0

    logger.info(
        "OpenAI OK | run_id=%s tokens_in=%d tokens_out=%d",
        resp.id, tokens_in, tokens_out,
    )
    return parsed, resp.id, tokens_in, tokens_out


# ── TX2 sincrona (para ejecutar en executor) ─────────────────────────────────

def _execute_tx2_sync(payload: dict) -> tuple[str, str, int, int, str, str]:
    """
    Ejecuta TX2 de forma sincrona:
      1. Descarga archivos desde MinIO         (usa file_metadata[].fileName)
      2. Llama a OpenAI                        (usa files[].fileName)
      3. Vuelca trace si TRACE_ENABLED         (usa files[].fileName)
      4. Envia resultado al backend via HTTP   (envia input_objects_meta tal cual)

    Retorna (openai_run_id, version_id, tokens_in, tokens_out, ai_provider, ai_model).
    """
    tx_id         = payload["transaction_id"]
    rec_id        = payload["record_id"]
    by_id         = payload["requested_by_id"]
    profile       = payload["ai_profile"]            # { profile_id, profile_name, ... }
    ai_input      = payload["ai_input_schema"]
    file_metadata = payload["file_metadata"]         # [{ fileName, mimeType, sha256, fileType }]
    ometa         = payload.get("input_objects_meta", [])   # [{ obj_id, art_type_id, fname }]
    cat           = payload.get("catalog_ids", {})

    minio = _get_minio()

    # 1. Descargar archivos
    logger.info("Descargando %d archivos | record=%s", len(file_metadata), rec_id)
    files = _download_files_from_minio(minio, rec_id, file_metadata)
    if not files:
        raise ValueError("No se pudieron descargar archivos desde MinIO")

    provider_config = _resolve_runtime_ai_provider()

    # 2. Cargar prompt
    additional_notes = ai_input.get("additionalNotes", "")
    prompt = _load_agent_prompt(profile, additional_notes)

    # 3. Llamar al proveedor IA configurado
    ai_output, run_id, tokens_in, tokens_out = _call_openai_sync(provider_config, prompt, files, ai_input)

    # 4. Trace
    _trace_write(
        tx_id=tx_id,
        prompt=prompt,
        ai_input=ai_input,
        ai_output=ai_output,
        files=files,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        ai_provider=provider_config["provider_type"],
        ai_model=provider_config["model_name"],
        run_id=run_id,
    )

    derived_fields = {}
    inferred_actual_end_time = _infer_actual_end_time(ai_input, files)
    if inferred_actual_end_time:
        derived_fields["actual_end_time"] = inferred_actual_end_time

    # 5. Enviar al backend para persistencia (TX2)
    result = commit_tx2(
        transaction_id=tx_id,
        record_id=rec_id,
        requested_by_id=by_id,
        ai_output=ai_output,
        ai_input_schema=ai_input,
        derived_fields=derived_fields,
        ai_provider=provider_config["provider_type"],
        ai_model=provider_config["model_name"],
        openai_run_id=run_id,
        tokens_input=tokens_in,
        tokens_output=tokens_out,
        input_objects_meta=ometa,   # [{ obj_id, art_type_id, fname }] — tal cual del backend
        catalog_ids=cat,
    )

    version_id = result.get("version_id", "unknown")
    logger.info("Backend confirmo TX2 | version=%s", version_id)
    return run_id, version_id, tokens_in, tokens_out, provider_config["provider_type"], provider_config["model_name"]


# ── Handler principal ─────────────────────────────────────────────────────────

async def handle_minutes_job(job: JobEnvelope) -> None:
    """
    Handler principal para jobs de tipo 'minutes'.
    Ejecuta TX2 en un executor para no bloquear el event loop.
    """
    payload = job.payload
    tx_id   = payload.get("transaction_id", "unknown")
    rec_id  = payload.get("record_id",      "unknown")

    logger.info(
        "Iniciando TX2 | tx=%s record=%s job_id=%s attempt=%d",
        tx_id, rec_id, job.job_id, job.attempt,
    )

    redis  = await get_redis()
    status = "failed"
    error  = ""
    failure_reported = False

    try:
        loop = asyncio.get_event_loop()
        run_id, version_id, tokens_in, tokens_out, ai_provider, ai_model = await loop.run_in_executor(
            None, _execute_tx2_sync, payload
        )

        status = "completed"
        logger.info(
            "TX2 completada | tx=%s provider=%s model=%s run=%s tokens=%d/%d version=%s",
            tx_id, ai_provider, ai_model, run_id, tokens_in, tokens_out, version_id,
        )

    except NonRetryableMinuteError as exc:
        error = str(exc)
        logger.error("Error terminal de procesamiento | tx=%s status=%s error=%s", tx_id, exc.record_status, error)
        try:
            await asyncio.to_thread(
                report_minute_failure,
                tx_id,
                rec_id,
                payload.get("requested_by_id", ""),
                error,
                record_status=exc.record_status,
                source="worker",
            )
            failure_reported = True
        except Exception as report_exc:
            logger.error("No se pudo reportar fallo terminal al backend | tx=%s err=%s", tx_id, report_exc)
        logger.warning("Error terminal no reintentable — descartando job | tx=%s", tx_id)
        return

    except BackendClientError as exc:
        error = str(exc)
        logger.error("Error de comunicacion con backend | tx=%s: %s", tx_id, error)
        if not exc.retryable:
            try:
                await asyncio.to_thread(
                    report_minute_failure,
                    tx_id,
                    rec_id,
                    payload.get("requested_by_id", ""),
                    error,
                    record_status="processing-error",
                    source="backend_client",
                )
                failure_reported = True
            except Exception as report_exc:
                logger.error("No se pudo reportar fallo terminal al backend | tx=%s err=%s", tx_id, report_exc)
            # Error de datos — no reintenta
            logger.warning("Error no reintentable — descartando job | tx=%s", tx_id)
            return
        raise

    except Exception as exc:
        error = str(exc)
        logger.error("TX2 fallida | tx=%s error=%s", tx_id, error, exc_info=True)
        raise

    finally:
        # Solo publicamos failed desde el worker si el proceso fallo.
        # Si fue exitoso, el backend ya publico el evento completed.
        if status == "failed" and error and not failure_reported:
            try:
                event = {
                    "event":          "failed",
                    "transaction_id": tx_id,
                    "record_id":      rec_id,
                    "error":          error[:500],
                }
                await redis.publish(PUBSUB_CHANNEL, json.dumps(event))
                logger.info("Evento failed publicado | tx=%s", tx_id)
            except Exception as e:
                logger.error("Error publicando evento failed (ignorado): %s", e)

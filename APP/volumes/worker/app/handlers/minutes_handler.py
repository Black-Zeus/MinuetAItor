# handlers/minutes_handler.py
"""
Handler de jobs de tipo 'minutes' - Ejecuta TX2 del pipeline.
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import openai
from minio import Minio
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from core.config import settings
from core.logging_config import get_logger
from core.job import JobEnvelope
from core.redis_client import get_redis

logger = get_logger("worker.handler.minutes")

# Constantes
BUCKET_INPUTS = "minuetaitor-inputs"
BUCKET_JSON = "minuetaitor-json"
PUBSUB_CHANNEL = settings.PUBSUB_MINUTES_CHANNEL

# Lazy-init de conexiones
_engine = None
_SessionLocal = None
_minio_client = None


def _get_db_session() -> Session:
    """Obtiene una sesión de base de datos."""
    global _engine, _SessionLocal
    if _engine is None:
        _engine = create_engine(
            settings.DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=3600,
            pool_size=3,
            max_overflow=2,
        )
        _SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)
    return _SessionLocal()


def _get_minio() -> Minio:
    """Obtiene el cliente de MinIO."""
    global _minio_client
    if _minio_client is None:
        _minio_client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_USER,
            secret_key=settings.MINIO_PASSWORD,
            secure=settings.MINIO_SECURE,
        )
    return _minio_client


# ─── Helpers ────────────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _load_agent_prompt(ai_profile: dict, additional_notes: str = "") -> str:
    """Carga y renderiza el prompt del agente."""
    prompt_path = Path(settings.PROMPT_PATH_BASE) / settings.OPENAI_SYSTEM_PROMPT
    
    if prompt_path.exists():
        tmpl = prompt_path.read_text(encoding="utf-8")
        logger.info(f"Prompt cargado desde archivo: {prompt_path}")
    else:
        # Fallback a prompt hardcodeado
        logger.warning(f"Archivo no encontrado: {prompt_path}, usando prompt por defecto")
        tmpl = """Eres un asistente experto en generar minutas de reuniones a partir de transcripciones y resúmenes.

Perfil: {profileName}
Descripción: {profileDescription}
Instrucciones específicas: {profilePrompt}

Notas adicionales: {additionalNotes}

Debes generar una minuta estructurada en formato JSON con las siguientes claves:
- scope: El alcance de la reunión, temas tratados
- agreements: Acuerdos tomados durante la reunión
- requirements: Requisitos o tareas identificadas
- upcomingMeetings: Próximas reuniones planificadas

Responde SIEMPRE con un objeto JSON válido y bien formado."""

    # Reemplazar variables
    tmpl = tmpl.replace("{profileId}", ai_profile["profile_id"])
    tmpl = tmpl.replace("{profileName}", ai_profile["profile_name"])
    tmpl = tmpl.replace("{profileDescription}", ai_profile.get("profile_description", ""))
    tmpl = tmpl.replace("{profilePrompt}", ai_profile.get("profile_prompt", "") or "Analiza la reunión.")
    tmpl = tmpl.replace("{additionalNotes}", additional_notes or "Sin notas adicionales.")
    tmpl = tmpl.replace("{userTags}", "Sin etiquetas.")
    
    return tmpl


def _download_files_from_minio(minio, record_id: str, file_metadata: list) -> list:
    """Descarga archivos desde MinIO."""
    result = []
    for meta in file_metadata:
        fname = meta["fileName"]
        mime = meta["mimeType"]
        obj_key = f"{record_id}/{fname}"
        
        try:
            logger.debug("Descargando archivo | key=%s", obj_key)
            resp = minio.get_object(BUCKET_INPUTS, obj_key)
            raw = resp.read()
            resp.close()
            resp.release_conn()
            result.append((fname, raw, mime))
            logger.info(f"Archivo descargado: {fname} ({len(raw)} bytes)")
        except Exception as e:
            logger.error(f"Error descargando {obj_key}: {e}")
            raise
    
    return result


def _call_openai_sync(prompt_system: str, files: list, ai_input: dict) -> tuple[dict, str, int, int]:
    """
    Llama a OpenAI de forma síncrona.
    Siempre usa método inline para archivos de texto.
    """
    client = openai.OpenAI(
        api_key=settings.OPENAI_API_KEY,
        timeout=settings.OPENAI_TIMEOUT
    )
    
    # Preparar contenido para OpenAI - TODO como texto inline
    content_parts = []
    
    for fname, raw, mime in files:
        try:
            # Decodificar como texto (asumimos UTF-8)
            text = raw.decode("utf-8", errors="replace")
            
            # Truncar si es muy largo para evitar tokens excesivos
            if len(text) > 50000:  # ~50k caracteres
                text = text[:50000] + "... [truncado por longitud]"
                logger.warning(f"Archivo truncado por longitud: {fname}")
            
            content_parts.append({
                "type": "text",
                "text": f"[Archivo: {fname}]\n{text}"
            })
            logger.debug(f"Archivo incluido inline: {fname}")
            
        except Exception as e:
            logger.warning(f"Error procesando {fname}: {e}")
            content_parts.append({
                "type": "text",
                "text": f"[Archivo: {fname}] (no se pudo procesar)"
            })
    
    # Agregar contexto estructurado
    content_parts.append({
        "type": "text",
        "text": f"[Contexto estructurado de la reunión]\n{json.dumps(ai_input, ensure_ascii=False, indent=2)}"
    })
    
    # Asegurar que el prompt incluya la palabra "json"
    if "json" not in prompt_system.lower():
        prompt_system += "\n\nIMPORTANTE: Debes responder SIEMPRE con un objeto JSON válido que contenga las claves: scope, agreements, requirements, upcomingMeetings."
    
    logger.info("Llamando a OpenAI | model=%s archivos=%d partes=%d", 
                settings.OPENAI_MODEL, len(files), len(content_parts))
    
    # Crear mensajes
    messages = [
        {"role": "system", "content": prompt_system},
        {"role": "user", "content": content_parts}
    ]
    
    # Log del tamaño aproximado
    total_chars = sum(len(str(p)) for p in content_parts)
    logger.info(f"Total caracteres en contenido: ~{total_chars}")
    
    # Llamada a la API
    try:
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            max_tokens=settings.OPENAI_MAX_TOKENS,
            messages=messages,
            response_format={"type": "json_object"},
        )
    except Exception as e:
        logger.error(f"Error en llamada a OpenAI: {e}")
        # Log de diagnóstico
        logger.debug(f"Prompt system (primeros 200): {prompt_system[:200]}")
        logger.debug(f"Número de partes de contenido: {len(content_parts)}")
        raise
    
    raw_text = resp.choices[0].message.content or ""
    
    # Parsear respuesta JSON
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON inválido recibido: {raw_text[:200]}")
        raise RuntimeError(f"IA retornó JSON inválido: {e}")
    
    # Validar estructura mínima
    required = ["scope", "agreements", "requirements", "upcomingMeetings"]
    missing = [k for k in required if k not in parsed]
    if missing:
        raise RuntimeError(f"Respuesta de IA incompleta. Faltantes: {missing}")
    
    usage = resp.usage
    tokens_in = getattr(usage, "prompt_tokens", 0) if usage else 0
    tokens_out = getattr(usage, "completion_tokens", 0) if usage else 0
    
    logger.info("OpenAI OK | tokens_in=%d tokens_out=%d", tokens_in, tokens_out)
    return parsed, resp.id, tokens_in, tokens_out


def _create_artifacts_and_version(db: Session, payload: dict, ai_output: dict, 
                                  run_id: str, tokens_in: int, tokens_out: int) -> str:
    """Crea RecordVersion y artefactos en base de datos."""
    from models.minute_transaction import MinuteTransaction
    from models.objects import Object
    from models.record_artifacts import RecordArtifact
    from models.record_drafts import RecordDraft
    from models.record_versions import RecordVersion
    from models.records import Record
    
    tx_id = payload["transaction_id"]
    rec_id = payload["record_id"]
    by_id = payload["requested_by_id"]
    ometa = payload["input_objects_meta"]
    cat = payload["catalog_ids"]
    
    minio = _get_minio()
    
    # Obtener transacción y record
    tx = db.query(MinuteTransaction).filter_by(id=tx_id).first()
    record = db.query(Record).filter_by(id=rec_id).first()
    
    if not tx or not record:
        raise RuntimeError(f"Transaction o Record no encontrado | tx={tx_id}")
    
    # Subir outputs a MinIO
    out_bytes = json.dumps(ai_output, ensure_ascii=False, indent=2).encode("utf-8")
    
    # Output LLM original
    llm_key = f"{rec_id}/llm_output_v1.json"
    llm_obj_id = str(uuid.uuid4())
    minio.put_object(
        BUCKET_JSON, llm_key,
        io.BytesIO(out_bytes), len(out_bytes),
        "application/json"
    )
    db.add(Object(
        id=llm_obj_id,
        bucket_id=cat["bucket_json_id"],
        object_key=llm_key,
        content_type="application/json",
        file_ext="json",
        size_bytes=len(out_bytes),
        sha256=_sha256_bytes(out_bytes),
        created_by=by_id
    ))
    
    # Output canónico
    can_key = f"{rec_id}/schema_output_v1.json"
    can_obj_id = str(uuid.uuid4())
    minio.put_object(
        BUCKET_JSON, can_key,
        io.BytesIO(out_bytes), len(out_bytes),
        "application/json"
    )
    db.add(Object(
        id=can_obj_id,
        bucket_id=cat["bucket_json_id"],
        object_key=can_key,
        content_type="application/json",
        file_ext="json",
        size_bytes=len(out_bytes),
        sha256=_sha256_bytes(out_bytes),
        created_by=by_id
    ))
    
    # Crear RecordVersion
    ver_id = str(uuid.uuid4())
    version = RecordVersion(
        id=ver_id,
        record_id=rec_id,
        version_num=1,
        status_id=cat["version_status_id"],
        published_by=by_id,
        schema_version="1.0",
        template_version="1.0",
        ai_model=settings.OPENAI_MODEL,
        openai_run_id=run_id,
        tokens_input=tokens_in,
        tokens_output=tokens_out
    )
    db.add(version)
    
    # Crear RecordDraft
    db.add(RecordDraft(
        record_id=rec_id,
        created_by=by_id
    ))
    
    db.flush()
    
    # Asociar versión a transacción
    tx.record_version_id = ver_id
    
    # Artefactos de INPUT
    for m in ometa:
        art = RecordArtifact(
            record_id=rec_id,
            artifact_type_id=m["art_type_id"],
            artifact_state_id=cat["state_original_id"],
            object_id=m["obj_id"],
            record_version_id=ver_id,
            is_draft=False,
            natural_name=m["fname"],
            created_by=by_id
        )
        db.add(art)
    
    # Artefactos de OUTPUT
    art_llm = RecordArtifact(
        record_id=rec_id,
        artifact_type_id=cat["art_llm_orig_id"],
        artifact_state_id=cat["state_original_id"],
        object_id=llm_obj_id,
        record_version_id=ver_id,
        is_draft=False,
        natural_name="llm_output_v1.json",
        created_by=by_id
    )
    
    art_can = RecordArtifact(
        record_id=rec_id,
        artifact_type_id=cat["art_canonical_id"],
        artifact_state_id=cat["state_ready_id"],
        object_id=can_obj_id,
        record_version_id=None,
        is_draft=True,
        natural_name="schema_output_v1.json",
        created_by=by_id
    )
    
    db.add(art_llm)
    db.add(art_can)
    
    # Actualizar transacción y record
    tx.status = "completed"
    tx.completed_at = _now_utc()
    tx.output_object_id = can_obj_id
    tx.openai_run_id = run_id
    tx.tokens_input = tokens_in
    tx.tokens_output = tokens_out
    
    record.active_version_id = ver_id
    record.latest_version_num = 1
    
    db.commit()
    logger.info("TX2 completada | tx=%s version=%s", tx_id, ver_id)
    
    return ver_id


def _execute_tx2_sync(payload: dict) -> tuple[str, str, int, int]:
    """
    Ejecuta TX2 de forma síncrona (para correr en executor).
    Retorna (run_id, version_id, tokens_in, tokens_out)
    """
    tx_id = payload["transaction_id"]
    rec_id = payload["record_id"]
    profile = payload["ai_profile"]
    ai_input = payload["ai_input_schema"]
    file_metadata = payload["file_metadata"]
    
    db = _get_db_session()
    minio = _get_minio()
    
    try:
        # 1. Descargar archivos
        logger.info(f"Descargando {len(file_metadata)} archivos desde MinIO")
        files = _download_files_from_minio(minio, rec_id, file_metadata)
        if not files:
            raise ValueError("No se pudieron descargar archivos desde MinIO")
        
        # 2. Cargar prompt
        additional_notes = ai_input.get("additionalNotes", "")
        prompt = _load_agent_prompt(profile, additional_notes)
        
        # 3. Llamar a OpenAI (siempre inline)
        ai_output, run_id, tokens_in, tokens_out = _call_openai_sync(prompt, files, ai_input)
        
        # 4. Crear artefactos y versión
        version_id = _create_artifacts_and_version(db, payload, ai_output, run_id, tokens_in, tokens_out)
        
        db.close()
        return run_id, version_id, tokens_in, tokens_out
        
    except Exception as e:
        db.rollback()
        db.close()
        
        # Marcar transacción como fallida
        try:
            db2 = _get_db_session()
            tx = db2.query(MinuteTransaction).filter_by(id=tx_id).first()
            if tx:
                tx.status = "failed"
                tx.error_message = str(e)[:1000]
                db2.commit()
            db2.close()
        except Exception as db_err:
            logger.error(f"Error marcando transacción como fallida: {db_err}")
        
        raise


# ─── Handler principal ─────────────────────────────────────────────────────

async def handle_minutes_job(job: JobEnvelope) -> None:
    """
    Handler principal para jobs de minutos.
    Ejecuta TX2 en un executor para no bloquear el event loop.
    """
    payload = job.payload
    tx_id = payload.get("transaction_id", "unknown")
    rec_id = payload.get("record_id", "unknown")
    
    logger.info(
        "Iniciando TX2 | tx=%s record=%s job_id=%s attempt=%d",
        tx_id, rec_id, job.job_id, job.attempt
    )
    
    redis = await get_redis()
    status = "failed"
    error = ""
    
    try:
        # Ejecutar TX2 en executor (operaciones bloqueantes: DB, OpenAI, MinIO)
        loop = asyncio.get_event_loop()
        run_id, version_id, tokens_in, tokens_out = await loop.run_in_executor(
            None, _execute_tx2_sync, payload
        )
        
        status = "completed"
        logger.info(
            "TX2 completada exitosamente | tx=%s run=%s tokens=%d/%d version=%s",
            tx_id, run_id, tokens_in, tokens_out, version_id
        )
        
    except Exception as exc:
        error = str(exc)
        logger.error(
            "TX2 fallida | tx=%s error=%s",
            tx_id, error, exc_info=True
        )
        raise
        
    finally:
        # Publicar resultado para que el backend notifique al frontend
        try:
            event = {
                "event": status,
                "transaction_id": tx_id,
                "record_id": rec_id,
            }
            if error:
                event["error"] = error[:500]
            
            await redis.publish(PUBSUB_CHANNEL, json.dumps(event))
            logger.info("Evento publicado | status=%s tx=%s", status, tx_id)
            
        except Exception as e:
            logger.error("Error publicando evento: %s", e)
# handlers/minutes_handler.py
"""
Handler de jobs de tipo 'minutes' — ejecuta TX2 del pipeline de generación.

Responsabilidades:
    1. Recibir el payload encolado por el backend (post-TX1)
    2. Descargar archivos de input desde MinIO
    3. Llamar a OpenAI
    4. Persistir artefactos de output + RecordVersion + RecordDraft (TX2)
    5. Actualizar MinuteTransaction a "completed" o "failed"
    6. Publicar evento en Redis Pub/Sub → el backend lo reenvía al frontend por SSE

Payload esperado en JobEnvelope.payload:
{
    "transaction_id":    "uuid",
    "record_id":         "uuid",
    "requested_by_id":   "uuid",
    "ai_profile": {
        "profile_id":          "uuid",
        "profile_name":        "...",
        "profile_description": "...",
        "profile_prompt":      "..."
    },
    "ai_input_schema":   { ... },
    "file_metadata":     [ { "fileName", "mimeType", "sha256", "fileType" } ],
    "input_objects_meta":[ { "obj_id", "art_type_id", "fname" } ],
    "catalog_ids": {
        "version_status_id", "bucket_json_id",
        "art_llm_orig_id", "art_canonical_id",
        "state_original_id", "state_ready_id"
    }
}
"""
from __future__ import annotations

import asyncio
import io
import json
import logging
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
from core.redis_client import get_redis

logger = get_logger("worker.handler.minutes")

BUCKET_INPUTS  = "minuetaitor-inputs"
BUCKET_JSON    = "minuetaitor-json"
PUBSUB_CHANNEL = settings.PUBSUB_MINUTES_CHANNEL

# ── Lazy-init de infra ────────────────────────────────────────────────────────
_engine       = None
_SessionLocal = None
_minio_client = None


def _get_db_session() -> Session:
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
    global _minio_client
    if _minio_client is None:
        _minio_client = Minio(
            endpoint   = settings.MINIO_ENDPOINT,
            access_key = settings.MINIO_USER,
            secret_key = settings.MINIO_PASSWORD,
            secure     = settings.MINIO_SECURE,
        )
    return _minio_client


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _sha256_bytes(data: bytes) -> str:
    import hashlib
    return hashlib.sha256(data).hexdigest()


def _reload_files_from_minio(minio, record_id, file_metadata):
    result = []
    for meta in file_metadata:
        fname   = meta["fileName"]
        mime    = meta["mimeType"]
        obj_key = f"{record_id}/{fname}"
        try:
            resp = minio.get_object(BUCKET_INPUTS, obj_key)
            raw  = resp.read()
            resp.close()
            resp.release_conn()
            result.append((fname, raw, mime))
        except Exception as e:
            logger.warning("No se pudo recargar %s: %s", obj_key, e)
    return result


def _load_agent_prompt(ai_profile: dict, additional_notes: str = "") -> str:
    prompt_path = Path(settings.PROMPT_PATH_BASE) / settings.OPENAI_SYSTEM_PROMPT
    if prompt_path.exists():
        tmpl = prompt_path.read_text(encoding="utf-8")
        tmpl = tmpl.replace("{profileId}",          ai_profile["profile_id"])
        tmpl = tmpl.replace("{profileName}",        ai_profile["profile_name"])
        tmpl = tmpl.replace("{profileDescription}", ai_profile.get("profile_description", ""))
        tmpl = tmpl.replace("{profilePrompt}",      ai_profile.get("profile_prompt", "") or "Analiza la reunión.")
        tmpl = tmpl.replace("{additionalNotes}",    additional_notes or "Sin notas adicionales.")
        tmpl = tmpl.replace("{userTags}",           "Sin etiquetas.")
        return tmpl
    return f"Eres un asistente de reuniones. Perfil: {ai_profile['profile_name']}."


def _init_trace_dir(transaction_id: str, record_id: str) -> Optional[str]:
    try:
        ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(settings.TRACE_BASE_DIR, f"{ts}_{transaction_id[:8]}")
        os.makedirs(path, exist_ok=True)
        with open(os.path.join(path, "meta.json"), "w") as f:
            json.dump({"transaction_id": transaction_id, "record_id": record_id,
                       "created_at": datetime.now().isoformat(), "status": "initiated"}, f, indent=2)
        return path
    except Exception as e:
        logger.warning("No se pudo crear trace dir: %s", e)
        return None


def _finalize_trace(trace_dir, status, error=""):
    try:
        p = os.path.join(trace_dir, "meta.json")
        with open(p) as f:
            meta = json.load(f)
        meta.update({"status": status, "finalized_at": datetime.now().isoformat()})
        if error:
            meta["error"] = error[:1000]
        with open(p, "w") as f:
            json.dump(meta, f, indent=2)
    except Exception:
        pass


# ── OpenAI (síncrono) ─────────────────────────────────────────────────────────

def _call_openai_sync(prompt_system, files_for_openai, ai_input, trace_dir):
    NATIVE_MIMES = {"text/plain", "application/pdf", "image/png", "image/jpeg"}
    client = openai.OpenAI(api_key=settings.OPENAI_API_KEY, timeout=settings.OPENAI_TIMEOUT)

    content_parts = []
    use_native    = any(m.lower() in settings.OPENAI_MODEL.lower()
                        for m in settings.OPENAI_MODELS_WITH_FILE_SUPPORT)

    for fname, raw, mime in files_for_openai:
        if use_native and mime in NATIVE_MIMES:
            try:
                oai_file = client.files.create(file=(fname, io.BytesIO(raw), mime), purpose="assistants")
                content_parts.append({"type": "file", "file": {"file_id": oai_file.id}})
                logger.info("Archivo en OpenAI Files API | %s -> %s", fname, oai_file.id)
                continue
            except Exception as e:
                logger.warning("Fallback inline para %s: %s", fname, e)
        text = raw.decode("utf-8", errors="replace")
        content_parts.append({"type": "text", "text": f"[Archivo: {fname}]\n{text}"})

    content_parts.append({"type": "text",
                           "text": f"[Contexto]\n{json.dumps(ai_input, ensure_ascii=False, indent=2)}"})

    if trace_dir:
        try:
            with open(os.path.join(trace_dir, "ai_input.json"), "w") as f:
                json.dump(ai_input, f, ensure_ascii=False, indent=2)
            with open(os.path.join(trace_dir, "prompt_system.txt"), "w") as f:
                f.write(prompt_system)
        except Exception:
            pass

    logger.info("Llamando a OpenAI | model=%s archivos=%d", settings.OPENAI_MODEL, len(files_for_openai))

    resp     = client.chat.completions.create(
        model           = settings.OPENAI_MODEL,
        max_tokens      = settings.OPENAI_MAX_TOKENS,
        messages        = [{"role": "system", "content": prompt_system},
                           {"role": "user",   "content": content_parts}],
        response_format = {"type": "json_object"},
    )
    raw_text = resp.choices[0].message.content or ""

    if trace_dir:
        try:
            with open(os.path.join(trace_dir, "ai_output_raw.txt"), "w") as f:
                f.write(raw_text)
        except Exception:
            pass

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"IA retornó JSON inválido: {e}")

    missing = [k for k in ["scope", "agreements", "requirements", "upcomingMeetings"] if k not in parsed]
    if missing:
        raise RuntimeError(f"Respuesta de IA incompleta. Faltantes: {missing}")

    usage      = resp.usage
    tokens_in  = getattr(usage, "prompt_tokens",     0) if usage else 0
    tokens_out = getattr(usage, "completion_tokens", 0) if usage else 0
    logger.info("OpenAI OK | tokens_in=%d tokens_out=%d", tokens_in, tokens_out)
    return parsed, resp.id, tokens_in, tokens_out


# ── TX2 síncrono ──────────────────────────────────────────────────────────────

def _execute_tx2_sync(payload: dict) -> None:
    from models.minute_transaction import MinuteTransaction
    from models.objects            import Object
    from models.record_artifacts   import RecordArtifact
    from models.record_drafts      import RecordDraft
    from models.record_versions    import RecordVersion
    from models.records            import Record

    tx_id    = payload["transaction_id"]
    rec_id   = payload["record_id"]
    by_id    = payload["requested_by_id"]
    profile  = payload["ai_profile"]
    ai_input = payload["ai_input_schema"]
    fmeta    = payload["file_metadata"]
    ometa    = payload["input_objects_meta"]
    cat      = payload["catalog_ids"]

    trace = _init_trace_dir(tx_id, rec_id)
    minio = _get_minio()
    db    = _get_db_session()
    tx    = None

    try:
        tx     = db.query(MinuteTransaction).filter_by(id=tx_id).first()
        record = db.query(Record).filter_by(id=rec_id).first()

        if not tx or not record:
            raise RuntimeError(f"Transaction o Record no encontrado | tx={tx_id}")

        # 1. Recargar archivos
        files = _reload_files_from_minio(minio, rec_id, fmeta)
        if not files:
            raise ValueError("No se pudieron recargar archivos desde MinIO")

        # 2. Prompt
        prompt = _load_agent_prompt(profile, ai_input.get("additionalNotes", ""))

        # 3. OpenAI
        ai_output, run_id, tk_in, tk_out = _call_openai_sync(prompt, files, ai_input, trace)

        # 4. Subir outputs a MinIO
        out_bytes = json.dumps(ai_output, ensure_ascii=False, indent=2).encode("utf-8")

        llm_key    = f"{rec_id}/llm_output_v1.json"
        llm_obj_id = str(uuid.uuid4())
        minio.put_object(BUCKET_JSON, llm_key, io.BytesIO(out_bytes), len(out_bytes), "application/json")
        db.add(Object(id=llm_obj_id, bucket_id=cat["bucket_json_id"], object_key=llm_key,
                      content_type="application/json", file_ext="json",
                      size_bytes=len(out_bytes), sha256=_sha256_bytes(out_bytes), created_by=by_id))

        can_key    = f"{rec_id}/schema_output_v1.json"
        can_obj_id = str(uuid.uuid4())
        minio.put_object(BUCKET_JSON, can_key, io.BytesIO(out_bytes), len(out_bytes), "application/json")
        db.add(Object(id=can_obj_id, bucket_id=cat["bucket_json_id"], object_key=can_key,
                      content_type="application/json", file_ext="json",
                      size_bytes=len(out_bytes), sha256=_sha256_bytes(out_bytes), created_by=by_id))

        # 5. RecordVersion + RecordDraft (flush ANTES de artefactos — crítico)
        ver_id  = str(uuid.uuid4())
        version = RecordVersion(id=ver_id, record_id=rec_id, version_num=1,
                                status_id=cat["version_status_id"], published_by=by_id,
                                schema_version="1.0", template_version="1.0",
                                ai_model=settings.OPENAI_MODEL)
        db.add(version)
        db.add(RecordDraft(record_id=rec_id, created_by=by_id))
        db.flush()
        tx.record_version_id = ver_id

        # 6. Artefactos INPUT (requieren version_id)
        arts = []
        for m in ometa:
            a = RecordArtifact(record_id=rec_id, artifact_type_id=m["art_type_id"],
                               artifact_state_id=cat["state_original_id"], object_id=m["obj_id"],
                               record_version_id=ver_id, is_draft=False,
                               natural_name=m["fname"], created_by=by_id)
            arts.append(a)
            db.add(a)

        # 7. Artefactos OUTPUT
        art_llm = RecordArtifact(record_id=rec_id, artifact_type_id=cat["art_llm_orig_id"],
                                 artifact_state_id=cat["state_original_id"], object_id=llm_obj_id,
                                 record_version_id=ver_id, is_draft=False,
                                 natural_name="llm_output_v1.json", created_by=by_id)
        art_can = RecordArtifact(record_id=rec_id, artifact_type_id=cat["art_canonical_id"],
                                 artifact_state_id=cat["state_ready_id"], object_id=can_obj_id,
                                 record_version_id=None, is_draft=True,
                                 natural_name="schema_output_v1.json", created_by=by_id)
        db.add(art_llm)
        db.add(art_can)
        db.flush(arts + [art_llm, art_can])

        # 8. TX2 COMMIT
        tx.status           = "completed"
        tx.completed_at     = _now_utc()
        tx.output_object_id = can_obj_id
        tx.openai_run_id    = run_id
        tx.tokens_input     = tk_in
        tx.tokens_output    = tk_out
        record.active_version_id  = ver_id
        record.latest_version_num = 1
        db.commit()

        logger.info("TX2 COMMIT OK | tx=%s record=%s version=%s", tx_id, rec_id, ver_id)
        if trace:
            _finalize_trace(trace, "completed")

    except Exception as exc:
        err_msg = str(exc)
        logger.error("TX2 FAIL | tx=%s | %s", tx_id, err_msg, exc_info=True)
        if trace:
            _finalize_trace(trace, "failed", err_msg)
        try:
            db.rollback()
        except Exception:
            pass
        try:
            tx_ref = db.merge(tx) if tx else db.query(MinuteTransaction).filter_by(id=tx_id).first()
            if tx_ref:
                tx_ref.status        = "failed"
                tx_ref.error_message = err_msg[:1000]
                db.commit()
        except Exception as ce:
            logger.error("CRÍTICO: no se pudo commitear failed | tx=%s | %s", tx_id, ce)
        raise
    finally:
        db.close()


# ── Entry point async ─────────────────────────────────────────────────────────

async def handle_minutes_job(payload: dict[str, Any]) -> None:
    tx_id  = payload.get("transaction_id", "unknown")
    rec_id = payload.get("record_id",      "unknown")

    logger.info("Iniciando TX2 | tx=%s record=%s", tx_id, rec_id)

    redis  = await get_redis()
    status = "failed"
    error  = ""

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _execute_tx2_sync, payload)
        status = "completed"
    except Exception as exc:
        error  = str(exc)[:500]
        raise
    finally:
        try:
            event = {"event": status, "transaction_id": tx_id, "record_id": rec_id}
            if error:
                event["error"] = error
            await redis.publish(PUBSUB_CHANNEL, json.dumps(event))
            logger.info("Pub/Sub publicado | status=%s tx=%s", status, tx_id)
        except Exception as e:
            logger.error("No se pudo publicar evento Pub/Sub: %s", e)
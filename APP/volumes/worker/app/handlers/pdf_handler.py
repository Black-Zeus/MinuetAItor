"""
handlers/pdf_handler.py

Handler de jobs de tipo 'pdf'.

Genera PDFs desde el JSON canónico del LLM usando Jinja2 + Gotenberg,
los sube a MinIO y notifica el resultado por Redis pub/sub.

Payload esperado (PdfJobPayload serializado):
{
    "job_id": "pdf-uuid",
    "job_type": "generate_pdf",
    "context": {
        "record_id": "...",
        "version_id": "...",
        "record_status": "review",
        "trigger": "post_ai_processing",
        "transaction_id": "..."
    },
    "options": {
        "watermark": true,
        "watermark_text": "BORRADOR",
        "template": "minutes/default",
        "output_bucket": "minuetaitor-draft",
        "output_key": "drafts/{record_id}/draft_current.pdf"
    },
    "pdf_metadata": { ... },   # datos del record (client, project, etc.)
    "ia_response": { ... },    # JSON canónico del LLM
    "callback": {
        "notify_redis_channel": "channel:record:{record_id}:pdf_ready",
        "pdf_url_field": "draft_pdf_url",
        "status_on_success": null,
        "status_on_fail": "pdf_error"
    }
}
"""

from __future__ import annotations

import asyncio
import io
import json
import os
from typing import Any

import requests
from minio import Minio
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from core.config import settings
from core.logging_config import get_logger
from core.job import JobEnvelope
from schemas.pdf_job import PdfJobPayload

logger = get_logger("worker.handler.pdf")

# ---------------------------------------------------------------------------
# Clientes externos — inicializados lazy al primer uso
# ---------------------------------------------------------------------------

_minio_client: Minio | None = None
_SessionLocal: sessionmaker | None = None


def _get_minio() -> Minio:
    global _minio_client
    if _minio_client is None:
        _minio_client = Minio(
            endpoint   = settings.MINIO_ENDPOINT,
            access_key = settings.MINIO_ACCESS_KEY,
            secret_key = settings.MINIO_SECRET_KEY,
            secure     = settings.MINIO_SECURE,
        )
    return _minio_client


def _get_db_session() -> sessionmaker:
    global _SessionLocal
    if _SessionLocal is None:
        engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
        _SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return _SessionLocal


# ---------------------------------------------------------------------------
# Entry point del handler
# ---------------------------------------------------------------------------

async def handle_pdf_job(job: JobEnvelope) -> None:
    """
    Procesa un job de generación de PDF.

    Flujo:
      1. Deserializar payload como PdfJobPayload
      2. Renderizar template Jinja2 → HTML
      3. Enviar HTML a Gotenberg → bytes PDF
      4. Subir PDF a MinIO
      5. Actualizar DB (url + status opcional)
      6. Publicar notificación en Redis

    En caso de error: propaga la excepción para que el worker
    la maneje según su política de reintentos (igual que email_handler).
    """
    logger.info(
        "Iniciando generación PDF | job_id=%s attempt=%d",
        job.job_id, job.attempt,
    )

    # 1. Deserializar el payload completo
    pdf_job = _parse_payload(job)

    record_id = pdf_job.context.record_id
    trigger   = pdf_job.context.trigger

    logger.info(
        "Generando PDF | record_id=%s trigger=%s watermark=%s template=%s",
        record_id, trigger,
        pdf_job.options.watermark,
        pdf_job.options.template,
    )

    # 2 + 3. Render Jinja2 → HTML → Gotenberg → PDF bytes
    loop = asyncio.get_event_loop()
    pdf_bytes = await loop.run_in_executor(None, _render_pdf, pdf_job)

    # 4. Subir a MinIO
    pdf_url = await loop.run_in_executor(None, _upload_to_minio, pdf_job, pdf_bytes)

    # 5. Actualizar DB
    await loop.run_in_executor(None, _update_db, pdf_job, pdf_url)

    # 6. Notificar por Redis
    _notify_redis(job, pdf_job, pdf_url)

    logger.info(
        "PDF generado y subido | record_id=%s bucket=%s key=%s",
        record_id,
        pdf_job.options.output_bucket,
        pdf_job.options.output_key,
    )


# ---------------------------------------------------------------------------
# Paso 1: Deserializar payload
# ---------------------------------------------------------------------------

def _parse_payload(job: JobEnvelope) -> PdfJobPayload:
    """
    Convierte el payload del JobEnvelope en un PdfJobPayload tipado.
    El payload puede llegar como dict (ya deserializado) o como string JSON.
    """
    payload = job.payload

    if isinstance(payload, dict):
        return PdfJobPayload.model_validate(payload)

    if isinstance(payload, str):
        return PdfJobPayload.model_validate_json(payload)

    raise ValueError(f"Tipo de payload inesperado: {type(payload)}")


# ---------------------------------------------------------------------------
# Paso 2+3: Jinja2 → HTML → Gotenberg → PDF bytes
# ---------------------------------------------------------------------------

def _render_pdf(pdf_job: PdfJobPayload) -> bytes:
    """
    Renderiza el template y llama a Gotenberg.
    Se ejecuta en executor para no bloquear el event loop.
    """
    html = _render_template(pdf_job)
    return _call_gotenberg(html, pdf_job)


def _render_template(pdf_job: PdfJobPayload) -> str:
    """
    Renderiza el template Jinja2 con el contexto del job.

    El template recibe:
      - metadata    → PdfJobMetadata  (cabecera: client, project, número, versión...)
      - ia_response → IAResponse      (contenido completo de la minuta)
      - options     → PdfJobOptions   (watermark, etc.)
      - context     → PdfJobContext   (IDs de trazabilidad)

    Path del template: {TEMPLATES_DIR}/{options.template}.html
    Ejemplo: "minutes/default" → "/app/templates/minutes/default.html"
    """
    from jinja2 import Environment, FileSystemLoader, select_autoescape

    templates_dir = os.getenv("TEMPLATES_DIR", "/app/templates")
    template_path = f"{pdf_job.options.template}.html"

    env = Environment(
        loader     = FileSystemLoader(templates_dir),
        autoescape = select_autoescape(["html"]),
    )

    try:
        template = env.get_template(template_path)
    except Exception as exc:
        raise RuntimeError(
            f"Template no encontrado: {templates_dir}/{template_path} → {exc}"
        ) from exc

    rendered = template.render(
        metadata    = pdf_job.pdf_metadata,
        ia_response = pdf_job.ia_response,
        options     = pdf_job.options,
        context     = pdf_job.context,
    )

    logger.debug(
        "Template renderizado | template=%s record_id=%s",
        template_path, pdf_job.context.record_id,
    )
    return rendered


def _call_gotenberg(html: str, pdf_job: PdfJobPayload) -> bytes:
    """
    Envía el HTML a Gotenberg y retorna los bytes del PDF.
    Endpoint: POST /forms/chromium/convert/html
    """
    gotenberg_url = settings.GOTENBERG_URL.rstrip("/")
    endpoint      = f"{gotenberg_url}/forms/chromium/convert/html"

    files = {
        "files": ("index.html", html.encode("utf-8"), "text/html"),
    }

    data = {
        "marginTop":    "1.5",
        "marginBottom": "1.5",
        "marginLeft":   "1.5",
        "marginRight":  "1.5",
        "paperWidth":   "8.27",   # A4
        "paperHeight":  "11.69",
        "scale":        "1.0",
    }

    logger.debug(
        "Llamando Gotenberg | job_id=%s endpoint=%s",
        pdf_job.job_id, endpoint,
    )

    try:
        response = requests.post(endpoint, files=files, data=data, timeout=60)
        response.raise_for_status()
    except requests.exceptions.Timeout:
        raise RuntimeError(
            f"Gotenberg timeout para record_id={pdf_job.context.record_id}"
        )
    except requests.exceptions.HTTPError as exc:
        raise RuntimeError(
            f"Gotenberg error HTTP {exc.response.status_code}: {exc.response.text[:300]}"
        )

    logger.debug(
        "Gotenberg OK | record_id=%s size=%d bytes",
        pdf_job.context.record_id, len(response.content),
    )
    return response.content


# ---------------------------------------------------------------------------
# Paso 4: Subir PDF a MinIO
# ---------------------------------------------------------------------------

def _upload_to_minio(pdf_job: PdfJobPayload, pdf_bytes: bytes) -> str:
    """
    Sube el PDF al bucket y key indicados en options.
    Retorna la referencia interna: s3://{bucket}/{key}
    """
    minio  = _get_minio()
    bucket = pdf_job.options.output_bucket
    key    = pdf_job.options.output_key

    if not minio.bucket_exists(bucket):
        logger.warning("Bucket '%s' no existe, creándolo", bucket)
        minio.make_bucket(bucket)

    minio.put_object(
        bucket_name  = bucket,
        object_name  = key,
        data         = io.BytesIO(pdf_bytes),
        length       = len(pdf_bytes),
        content_type = "application/pdf",
    )

    logger.debug(
        "PDF subido a MinIO | bucket=%s key=%s size=%d bytes",
        bucket, key, len(pdf_bytes),
    )
    return f"s3://{bucket}/{key}"


# ---------------------------------------------------------------------------
# Paso 5: Actualizar DB
# ---------------------------------------------------------------------------

def _update_db(pdf_job: PdfJobPayload, pdf_url: str) -> None:
    """
    Actualiza minute_records en DB:
      - Escribe la URL en el campo pdf_url_field (draft_pdf_url o published_pdf_url)
      - Si status_on_success está definido, actualiza también record.status

    Usa SQL directo con whitelist de campos para seguridad.
    """
    record_id     = pdf_job.context.record_id
    pdf_url_field = pdf_job.callback.pdf_url_field
    new_status    = pdf_job.callback.status_on_success

    # Whitelist de campos permitidos — evita inyección via pdf_url_field
    ALLOWED_FIELDS = {"draft_pdf_url", "published_pdf_url"}
    if pdf_url_field not in ALLOWED_FIELDS:
        raise ValueError(f"pdf_url_field inválido: '{pdf_url_field}'")

    SessionLocal = _get_db_session()

    with SessionLocal() as db:
        try:
            if new_status:
                db.execute(
                    text(
                        f"UPDATE minute_records "
                        f"SET {pdf_url_field} = :url, status = :status, updated_at = NOW() "
                        f"WHERE id = :record_id"
                    ),
                    {"url": pdf_url, "status": new_status, "record_id": record_id},
                )
                logger.debug(
                    "DB actualizada | record_id=%s %s=%s status=%s",
                    record_id, pdf_url_field, pdf_url, new_status,
                )
            else:
                db.execute(
                    text(
                        f"UPDATE minute_records "
                        f"SET {pdf_url_field} = :url, updated_at = NOW() "
                        f"WHERE id = :record_id"
                    ),
                    {"url": pdf_url, "record_id": record_id},
                )
                logger.debug(
                    "DB actualizada | record_id=%s %s=%s",
                    record_id, pdf_url_field, pdf_url,
                )

            db.commit()

        except Exception:
            db.rollback()
            raise


# ---------------------------------------------------------------------------
# Paso 6: Notificar por Redis pub/sub
# ---------------------------------------------------------------------------

def _notify_redis(job: JobEnvelope, pdf_job: PdfJobPayload, pdf_url: str) -> None:
    """
    Publica en el canal Redis del callback.
    El cliente Redis lo obtiene del JobEnvelope (igual que otros handlers).
    """
    from core.redis_client import get_redis_client

    channel = pdf_job.callback.notify_redis_channel

    message = json.dumps({
        "event":     "pdf_ready",
        "job_id":    pdf_job.job_id,
        "record_id": pdf_job.context.record_id,
        "trigger":   pdf_job.context.trigger,
        "pdf_url":   pdf_url,
        "bucket":    pdf_job.options.output_bucket,
        "key":       pdf_job.options.output_key,
    })

    redis = get_redis_client()
    redis.publish(channel, message)

    logger.debug(
        "Notificación publicada | channel=%s record_id=%s",
        channel, pdf_job.context.record_id,
    )
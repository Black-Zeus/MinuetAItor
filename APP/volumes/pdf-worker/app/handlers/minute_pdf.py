# handlers/minute_pdf.py
"""
Handler para jobs de tipo 'minute_pdf'.

Cola:  queue:pdf
Tipo:  minute_pdf

Flujo:
    1. Leer contexto del payload
    2. Resolver nombre del template según payload.template
    3. Renderizar HTML con Jinja2
    4. Convertir a PDF con Gotenberg
    5. Subir PDF a MinIO en minio_output_key
    6. (Futuro) Notificar al backend via Redis pub/sub o callback

Payload esperado (JobEnvelope.payload):
    {
        "record_id":        "uuid",
        "version_id":       "uuid",
        "template":         "opc_01",          ← nombre sin extensión
        "minio_output_key": "minuetaitor-published/draft/{record_id}/...",
        "minio_bucket":     "minuetaitor-published",
        "options": {
            "watermark": true,
            "paper":     "A4"
        },
        "data": { ...contexto completo de la minuta... }
    }
"""
from __future__ import annotations

from core.job          import JobEnvelope
from core.logging_config import get_logger
from core.minio_client import get_minio
from renderer.jinja_engine   import render_template
from renderer.gotenberg_client import html_to_pdf, get_paper_size

logger = get_logger("pdf-worker.handlers.minute_pdf")

# Mapa template_name → archivo Jinja2
TEMPLATE_MAP: dict[str, str] = {
    "opc_01":    "minutes/opc_01.html",
    "opc_02":    "minutes/opc_02.html",
    "opc_03":    "minutes/opc_03.html",
    "opc_04":    "minutes/opc_04.html",
    # Aliases legibles
    "standard":   "minutes/opc_01.html",
    "executive":  "minutes/opc_02.html",
    "technical":  "minutes/opc_03.html",
    "governance": "minutes/opc_04.html",
}

DEFAULT_TEMPLATE = "minutes/opc_01.html"


async def handle_minute_pdf(job: JobEnvelope) -> None:
    """
    Procesa un job minute_pdf completo.
    Lanza excepción si algo falla (el worker manejará reintento/DLQ).
    """
    payload    = job.payload
    record_id  = payload["record_id"]
    version_id = payload.get("version_id", "unknown")
    template_key = payload.get("template", "opc_01")
    output_key = payload["minio_output_key"]
    bucket     = payload.get("minio_bucket", "minuetaitor-published")
    options    = payload.get("options", {})
    data       = payload.get("data", {})

    logger.info(
        "Procesando minute_pdf | record_id=%s version_id=%s template=%s",
        record_id, version_id, template_key,
    )

    # ── 1. Resolver template ───────────────────────────────────────────────────
    template_file = TEMPLATE_MAP.get(template_key, DEFAULT_TEMPLATE)
    logger.debug("Template resuelto | %s → %s", template_key, template_file)

    # ── 2. Construir contexto Jinja2 ───────────────────────────────────────────
    # El contexto fusiona los datos de la minuta con metadatos del job
    context = {
        **data,                                 # general_info, participants, scope, etc.
        "version_label": payload.get("version_label", "v1.0"),
        "options":       options,
        "record_id":     record_id,
    }

    # ── 3. Render HTML ────────────────────────────────────────────────────────
    html = render_template(template_file, context)

    # ── 4. Convertir a PDF ────────────────────────────────────────────────────
    paper = options.get("paper", "A4")
    width, height = get_paper_size(paper)

    pdf_bytes = await html_to_pdf(
        html=html,
        paper_width=width,
        paper_height=height,
    )

    # ── 5. Subir a MinIO ──────────────────────────────────────────────────────
    minio = get_minio()
    minio.put_object(
        bucket_name=bucket,
        object_name=output_key,
        data=__import__("io").BytesIO(pdf_bytes),
        length=len(pdf_bytes),
        content_type="application/pdf",
    )

    logger.info(
        "PDF subido a MinIO | bucket=%s key=%s bytes=%d",
        bucket, output_key, len(pdf_bytes),
    )

    # ── 6. TODO: Notificar al backend ──────────────────────────────────────────
    # await notify_backend(record_id, version_id, output_key)
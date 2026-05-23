from __future__ import annotations

import base64
import io

from core.redis_client import get_redis
from core.job import JobEnvelope
from core.logging_config import get_logger
from core.minio_client import get_minio
from renderer.gotenberg_client import get_paper_size, html_to_pdf
from renderer.jinja_engine import render_template

logger = get_logger("pdf-worker.handlers.report_pdf")

TEMPLATE_MAP: dict[str, str] = {
    "executive_summary_general": "reports/executive_summary_general.html",
}

DEFAULT_TEMPLATE = "reports/executive_summary_general.html"


async def handle_report_pdf(job: JobEnvelope) -> None:
    payload = job.payload
    template_key = payload.get("template", "executive_summary_general")
    output_key = payload.get("minio_output_key")
    bucket = payload.get("minio_bucket", "minuetaitor-draft")
    options = payload.get("options", {})
    response_storage = payload.get("response_storage") or {}
    data = payload.get("data", {})

    template_file = TEMPLATE_MAP.get(template_key, DEFAULT_TEMPLATE)
    html = render_template(template_file, data)

    paper = options.get("paper", "A4")
    width, height = get_paper_size(paper)
    if bool(options.get("landscape")):
        width, height = height, width

    pdf_bytes = await html_to_pdf(
        html=html,
        paper_width=width,
        paper_height=height,
    )

    if response_storage.get("mode") == "redis" and response_storage.get("key"):
        redis = await get_redis()
        ttl_seconds = max(int(response_storage.get("ttl_seconds") or 180), 30)
        encoded_pdf = base64.b64encode(pdf_bytes).decode("ascii")
        await redis.set(response_storage["key"], encoded_pdf, ex=ttl_seconds)

        logger.info(
            "PDF de reporte almacenado temporalmente en Redis | key=%s ttl=%ds bytes=%d",
            response_storage["key"],
            ttl_seconds,
            len(pdf_bytes),
        )

    if output_key:
        minio = get_minio()
        minio.put_object(
            bucket_name=bucket,
            object_name=output_key,
            data=io.BytesIO(pdf_bytes),
            length=len(pdf_bytes),
            content_type="application/pdf",
        )

        logger.info(
            "PDF de reporte subido a MinIO | bucket=%s key=%s bytes=%d",
            bucket,
            output_key,
            len(pdf_bytes),
        )

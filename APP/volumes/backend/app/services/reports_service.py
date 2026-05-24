from __future__ import annotations

import asyncio
import base64
import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.datetime_utils import to_santiago, utc_now
from db.redis import get_redis
from schemas.auth import UserSession
from schemas.report_exports import ReportPdfPreviewRequest
from services.minutes import queue as minute_queue
from services.organization_settings_service import (
    read_organization_banner_content,
    get_organization_settings,
    read_organization_logo_content,
)

QUEUE_PDF = "queue:pdf"
REPORT_PREVIEW_RESPONSE_PREFIX = "report:pdf:preview:"
REPORT_PREVIEW_META_PREFIX = "report:pdf:preview:meta:"
REPORT_PREVIEW_RESPONSE_TTL_SECONDS = 180
REPORT_CHART_PALETTE = [
    "#2563eb",
    "#059669",
    "#f59e0b",
    "#7c3aed",
    "#dc2626",
    "#64748b",
]


def _to_data_uri(content: bytes | None, content_type: str | None) -> str | None:
    if not content:
        return None
    mime_type = (content_type or "application/octet-stream").strip() or "application/octet-stream"
    encoded = base64.b64encode(content).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _format_generated_at(value: datetime) -> str:
    localized = to_santiago(value) or value
    return localized.strftime("%d-%m-%Y %H:%M")


def _safe_str(value: Any) -> str:
    if value is None:
        return "—"
    text = str(value).strip()
    return text or "—"


def _is_meaningful_filter_value(value: Any) -> bool:
    normalized = _safe_str(value).strip().lower()
    return normalized not in {"", "—", "todos", "todas"}


def _build_period_trend_chart(points: list[dict[str, Any]]) -> dict[str, Any]:
    width = 500
    height = 260
    left = 36
    right = 24
    top = 24
    bottom = 40
    chart_width = max(width - left - right, 1)
    chart_height = max(height - top - bottom, 1)

    if not points:
        return {"bars": [], "line_points": "", "circles": []}

    max_value = max(
        max(int(point.get("total", 0) or 0), int(point.get("completed", 0) or 0))
        for point in points
    )
    max_value = max(max_value, 1)

    total_points = len(points)
    step = chart_width / max(total_points, 1)
    bar_width = min(28, max(step * 0.42, 12))
    line_parts: list[str] = []
    circles: list[dict[str, float]] = []
    bars: list[dict[str, Any]] = []

    for index, point in enumerate(points):
        center_x = left + step * index + step / 2
        total_value = int(point.get("total", 0) or 0)
        completed_value = int(point.get("completed", 0) or 0)
        bar_height = (total_value / max_value) * chart_height
        bar_y = top + chart_height - bar_height
        line_y = top + chart_height - ((completed_value / max_value) * chart_height)

        bars.append(
            {
                "label": _safe_str(point.get("label")),
                "total": total_value,
                "x": round(center_x - (bar_width / 2), 2),
                "y": round(bar_y, 2),
                "width": round(bar_width, 2),
                "height": round(max(bar_height, 4), 2),
            }
        )
        line_parts.append(f"{round(center_x, 2)},{round(line_y, 2)}")
        circles.append({"cx": round(center_x, 2), "cy": round(line_y, 2)})

    return {
        "bars": bars,
        "line_points": " ".join(line_parts),
        "circles": circles,
    }


def _build_donut_style(items: list[dict[str, Any]]) -> str:
    if not items:
        return "conic-gradient(#cbd5e1 0 100%)"

    total = sum(max(int(item.get("count", 0) or 0), 0) for item in items)
    if total <= 0:
        return "conic-gradient(#cbd5e1 0 100%)"

    offset = 0.0
    segments: list[str] = []
    for index, item in enumerate(items):
        value = max(int(item.get("count", 0) or 0), 0)
        share = (value / total) * 100 if total else 0
        end = offset + share
        color = REPORT_CHART_PALETTE[index % len(REPORT_CHART_PALETTE)]
        segments.append(f"{color} {offset:.2f}% {end:.2f}%")
        offset = end
    return f"conic-gradient({', '.join(segments)})"


def _build_ranked_bars(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        return []

    max_value = max(max(int(item.get("count", 0) or 0), 0) for item in items)
    max_value = max(max_value, 1)
    ranked: list[dict[str, Any]] = []

    for index, item in enumerate(items):
        count = max(int(item.get("count", 0) or 0), 0)
        ranked.append(
            {
                "label": _safe_str(item.get("label")),
                "count": count,
                "width": max((count / max_value) * 100, 4),
                "color": REPORT_CHART_PALETTE[index % len(REPORT_CHART_PALETTE)],
            }
        )

    return ranked


def _build_chart_context(payload: ReportPdfPreviewRequest) -> dict[str, Any]:
    period_trend = [
        {
            "label": point.label,
            "total": point.total,
            "completed": point.completed,
        }
        for point in payload.chart_data.period_trend
    ]
    status_distribution = [
        {
            "label": item.label,
            "count": item.count,
            "color": REPORT_CHART_PALETTE[index % len(REPORT_CHART_PALETTE)],
        }
        for index, item in enumerate(payload.chart_data.status_distribution)
    ]
    client_activity = [
        {"label": item.label, "count": item.count}
        for item in payload.chart_data.client_activity[:6]
    ]
    project_activity = [
        {"label": item.label, "count": item.count}
        for item in payload.chart_data.project_activity[:6]
    ]

    total_status = sum(item["count"] for item in status_distribution) or 1
    for item in status_distribution:
        item["percent"] = round((item["count"] / total_status) * 100, 1)

    return {
        "period_trend": period_trend,
        "period_trend_chart": _build_period_trend_chart(period_trend),
        "status_distribution": status_distribution,
        "status_distribution_donut_style": _build_donut_style(status_distribution),
        "client_activity": _build_ranked_bars(client_activity),
        "project_activity": _build_ranked_bars(project_activity),
        "chart_images": [
            {
                "title": item.title,
                "subtitle": item.subtitle,
                "image_data_url": item.image_data_url,
            }
            for item in payload.chart_images
        ],
    }


def _build_table_context(payload: ReportPdfPreviewRequest) -> dict[str, Any]:
    columns = [
        {"key": column.key, "label": column.label}
        for column in payload.table_columns
    ]
    rows: list[dict[str, str]] = []

    for row in payload.table_rows:
        normalized = {
            column["key"]: _safe_str(row.get(column["key"]))
            for column in columns
        }
        rows.append(normalized)

    return {
        "table_columns": columns,
        "table_rows": rows,
        "total_records": len(rows),
    }


def _resolve_table_range_label(payload: ReportPdfPreviewRequest) -> str:
    if payload.table_range_label:
        return payload.table_range_label

    filters = {item.label.lower(): _safe_str(item.value) for item in payload.applied_filters}
    date_from = filters.get("fecha desde")
    date_to = filters.get("fecha hasta")

    if date_from and date_from != "—" and date_to and date_to != "—":
        return f"{date_from} al {date_to}"
    if date_from and date_from != "—":
        return f"Desde {date_from}"
    if date_to and date_to != "—":
        return f"Hasta {date_to}"
    return "Sin rango explícito"


def _build_report_context(
    db: Session,
    session: UserSession,
    payload: ReportPdfPreviewRequest,
) -> dict[str, Any]:
    organization = {}
    organization_logo_data_uri = None
    organization_banner_data_uri = None

    try:
        organization = get_organization_settings(db)
    except Exception:
        organization = {}

    try:
        logo_bytes, logo_content_type = read_organization_logo_content(db)
        organization_logo_data_uri = _to_data_uri(logo_bytes, logo_content_type)
    except Exception:
        organization_logo_data_uri = None

    try:
        banner_bytes, banner_content_type = read_organization_banner_content(db)
        organization_banner_data_uri = _to_data_uri(banner_bytes, banner_content_type)
    except Exception:
        organization_banner_data_uri = None

    generated_at = utc_now()
    organization_name = (
        payload.organization_name
        or organization.get("name")
        or organization.get("legal_name")
        or "MinuetAItor"
    )
    organization_area = (
        payload.organization_area
        or organization.get("contact_department")
        or payload.source_module
        or "Módulo de Reportes"
    )

    table_context = _build_table_context(payload)
    chart_context = _build_chart_context(payload)

    return {
        "organization_name": organization_name,
        "organization_area": organization_area,
        "organization_logo_data_uri": organization_logo_data_uri,
        "organization_banner_data_uri": organization_banner_data_uri,
        "report_type": payload.report_type,
        "report_title": payload.report_title,
        "report_description": payload.report_description,
        "report_key": payload.report_key,
        "source_module": payload.source_module,
        "generated_at_label": _format_generated_at(generated_at),
        "generated_by": session.full_name or session.username,
        "document_format_label": (
            f"PDF {'horizontal' if payload.orientation == 'landscape' else 'vertical'}"
        ),
        "applied_filters": [
            {"label": item.label, "value": _safe_str(item.value)}
            for item in payload.applied_filters
            if _is_meaningful_filter_value(item.value)
        ],
        "summary_metrics": [
            {
                "label": metric.label,
                "value": metric.value,
                "helper": metric.helper,
            }
            for metric in payload.summary_metrics
        ],
        "table_title": payload.table_title,
        "table_description": payload.table_description,
        "table_range_label": _resolve_table_range_label(payload),
        **table_context,
        **chart_context,
    }


async def generate_report_pdf_preview(
    db: Session,
    session: UserSession,
    payload: ReportPdfPreviewRequest,
) -> bytes:
    context = _build_report_context(db, session, payload)
    response_key = f"{REPORT_PREVIEW_RESPONSE_PREFIX}{payload.report_key}:{uuid.uuid4().hex}"

    envelope = {
        "job_id": f"report-pdf-{uuid.uuid4()}",
        "type": "report_pdf",
        "queue": QUEUE_PDF,
        "attempt": 1,
        "payload": {
            "template": payload.template_key,
            "options": {
                "paper": payload.paper_size,
                "landscape": payload.orientation == "landscape",
            },
            "response_storage": {
                "mode": "redis",
                "key": response_key,
                "ttl_seconds": REPORT_PREVIEW_RESPONSE_TTL_SECONDS,
            },
            "data": context,
        },
    }

    try:
        await minute_queue.enqueue_job(QUEUE_PDF, envelope)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "report_pdf_enqueue_error",
                "message": "No se pudo encolar la generación del PDF del reporte.",
            },
        ) from exc

    redis = get_redis()
    loop = asyncio.get_running_loop()
    deadline = loop.time() + 20
    last_error: Exception | None = None

    while loop.time() < deadline:
        try:
            encoded_pdf = await redis.get(response_key)
            if encoded_pdf:
                await redis.delete(response_key)
                return base64.b64decode(encoded_pdf)
        except Exception as exc:
            last_error = exc

        await asyncio.sleep(0.5)

    raise HTTPException(
        status_code=504,
        detail={
            "error": "report_pdf_preview_timeout",
            "message": "La generación del PDF del reporte tardó demasiado. Intenta nuevamente.",
            "last_error": str(last_error) if last_error else None,
        },
    )


def _report_preview_meta_key(preview_id: str) -> str:
    return f"{REPORT_PREVIEW_META_PREFIX}{preview_id}"


async def start_report_pdf_preview_job(
    db: Session,
    session: UserSession,
    payload: ReportPdfPreviewRequest,
) -> dict[str, Any]:
    context = _build_report_context(db, session, payload)
    preview_id = uuid.uuid4().hex
    response_key = f"{REPORT_PREVIEW_RESPONSE_PREFIX}{payload.report_key}:{preview_id}"

    envelope = {
        "job_id": f"report-pdf-{uuid.uuid4()}",
        "type": "report_pdf",
        "queue": QUEUE_PDF,
        "attempt": 1,
        "payload": {
            "template": payload.template_key,
            "options": {
                "paper": payload.paper_size,
                "landscape": payload.orientation == "landscape",
            },
            "response_storage": {
                "mode": "redis",
                "key": response_key,
                "ttl_seconds": REPORT_PREVIEW_RESPONSE_TTL_SECONDS,
            },
            "data": context,
        },
    }

    redis = get_redis()
    try:
        await redis.setex(
            _report_preview_meta_key(preview_id),
            REPORT_PREVIEW_RESPONSE_TTL_SECONDS,
            response_key,
        )
        await minute_queue.enqueue_job(QUEUE_PDF, envelope)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "report_pdf_enqueue_error",
                "message": "No se pudo iniciar la generación del PDF del reporte.",
            },
        ) from exc

    return {
        "preview_id": preview_id,
        "status": "queued",
        "expires_in": REPORT_PREVIEW_RESPONSE_TTL_SECONDS,
    }


async def get_report_pdf_preview_job_status(preview_id: str) -> dict[str, Any]:
    redis = get_redis()
    response_key = await redis.get(_report_preview_meta_key(preview_id))
    if not response_key:
        raise HTTPException(
            status_code=404,
            detail={"error": "report_pdf_preview_not_found", "message": "La vista previa ya expiró o no existe."},
        )

    encoded_pdf = await redis.get(response_key)
    if encoded_pdf:
        return {"preview_id": preview_id, "status": "ready", "size_bytes": len(encoded_pdf)}

    ttl = await redis.ttl(_report_preview_meta_key(preview_id))
    return {
        "preview_id": preview_id,
        "status": "processing",
        "expires_in": max(int(ttl or 0), 0),
    }


async def get_report_pdf_preview_job_result(preview_id: str) -> bytes:
    redis = get_redis()
    meta_key = _report_preview_meta_key(preview_id)
    response_key = await redis.get(meta_key)
    if not response_key:
        raise HTTPException(
            status_code=404,
            detail={"error": "report_pdf_preview_not_found", "message": "La vista previa ya expiró o no existe."},
        )

    encoded_pdf = await redis.get(response_key)
    if not encoded_pdf:
        raise HTTPException(
            status_code=409,
            detail={"error": "report_pdf_preview_not_ready", "message": "La vista previa aún se está generando."},
        )

    await redis.delete(response_key, meta_key)
    return base64.b64decode(encoded_pdf)

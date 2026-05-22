from __future__ import annotations

from typing import Any

DEFAULT_PDF_TEMPLATE = "opc_01"
SUPPORTED_PDF_TEMPLATES = ("opc_01", "opc_02", "opc_03", "opc_04", "opc_05")


def normalize_pdf_template(value: Any, fallback: str = DEFAULT_PDF_TEMPLATE) -> str:
    raw = str(value or "").strip().lower()
    if raw in SUPPORTED_PDF_TEMPLATES:
        return raw
    return fallback


def resolve_pdf_template_for_client(client: Any | None) -> str:
    if client is None:
        return DEFAULT_PDF_TEMPLATE
    return normalize_pdf_template(getattr(client, "default_pdf_template", None))


def resolve_pdf_template_for_project(project: Any | None) -> str:
    if project is None:
        return DEFAULT_PDF_TEMPLATE

    override = getattr(project, "pdf_template_override", None)
    if str(override or "").strip():
        return normalize_pdf_template(override)

    return resolve_pdf_template_for_client(getattr(project, "client", None))


def resolve_pdf_template_for_record(record: Any | None) -> str:
    if record is None:
        return DEFAULT_PDF_TEMPLATE

    project = getattr(record, "project", None)
    if project is not None:
        return resolve_pdf_template_for_project(project)

    return resolve_pdf_template_for_client(getattr(record, "client", None))


def ensure_pdf_template_in_content(content: dict[str, Any] | None, template: str) -> dict[str, Any] | None:
    if not isinstance(content, dict):
        return content

    resolved_template = normalize_pdf_template(template)
    pdf_format = content.get("pdfFormat")
    if not isinstance(pdf_format, dict):
        pdf_format = {}
        content["pdfFormat"] = pdf_format

    pdf_format["template"] = normalize_pdf_template(pdf_format.get("template"), fallback=resolved_template)
    return content

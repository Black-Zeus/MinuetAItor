# renderer/jinja_engine.py
"""
Motor Jinja2 para el pdf-worker.

Carga templates desde:
    app/templates/
        base/          ← layouts raíz (base.html)
        minutes/       ← minutas (opc_01..04)
        sheets/        ← hojas adicionales
        reports/       ← reportes

Uso:
    html = render_template("minutes/opc_01.html", context)
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import (
    Environment,
    FileSystemLoader,
    StrictUndefined,
    TemplateNotFound,
    select_autoescape,
)

from core.logging_config import get_logger

logger = get_logger("pdf-worker.renderer.jinja")

# ── Ruta base de templates ─────────────────────────────────────────────────────
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def _build_env() -> Environment:
    """Construye y configura el entorno Jinja2."""
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
        undefined=StrictUndefined,   # lanza error si una variable no existe
        trim_blocks=True,
        lstrip_blocks=True,
    )

    # ── Filtros personalizados ─────────────────────────────────────────────────

    def zfill_filter(value: Any, width: int = 3) -> str:
        """Rellena con ceros a la izquierda. Uso: {{ loop.index | zfill(3) }}"""
        return str(value).zfill(width)

    def default_dash(value: Any) -> str:
        """Retorna '—' si value es None o string vacío."""
        if value is None or value == "":
            return "—"
        return str(value)

    env.filters["zfill"]        = zfill_filter
    env.filters["default_dash"] = default_dash

    return env


# Instancia única del entorno (se reutiliza en todos los renders)
_env: Environment | None = None


def get_env() -> Environment:
    global _env
    if _env is None:
        _env = _build_env()
        logger.info("Jinja2 environment inicializado | templates_dir=%s", TEMPLATES_DIR)
    return _env


def render_template(template_name: str, context: dict[str, Any]) -> str:
    """
    Renderiza un template Jinja2 con el contexto dado.

    Args:
        template_name: Ruta relativa desde TEMPLATES_DIR.
                       Ejemplo: "minutes/opc_01.html"
        context:       Dict con todas las variables del template.

    Returns:
        String HTML listo para enviar a Gotenberg.

    Raises:
        TemplateNotFound: Si el template no existe.
        jinja2.UndefinedError: Si el contexto está incompleto.
    """
    env = get_env()

    try:
        template = env.get_template(template_name)
    except TemplateNotFound:
        available = list_templates()
        logger.error(
            "Template no encontrado | name=%s | disponibles=%s",
            template_name, available,
        )
        raise

    html = template.render(**context)
    logger.debug(
        "Template renderizado | name=%s | bytes=%d",
        template_name, len(html.encode("utf-8")),
    )
    return html


def list_templates(folder: str | None = None) -> list[str]:
    """Lista los templates disponibles, opcionalmente filtrados por carpeta."""
    env = get_env()
    all_templates = env.loader.list_templates()  # type: ignore[union-attr]
    
    if folder:
        return [t for t in all_templates if t.startswith(folder + "/")]
    return all_templates
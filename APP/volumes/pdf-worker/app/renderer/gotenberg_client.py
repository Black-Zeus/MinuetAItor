# renderer/gotenberg_client.py
"""
Cliente HTTP para Gotenberg (chromium HTML → PDF).

Endpoint usado:
    POST /forms/chromium/convert/html

Gotenberg recibe el HTML como archivo adjunto en multipart/form-data.
Retorna los bytes del PDF directamente.

Docs: https://gotenberg.dev/docs/routes#html-file-into-pdf-route
"""
from __future__ import annotations

import httpx

from core.config import settings
from core.logging_config import get_logger

logger = get_logger("pdf-worker.renderer.gotenberg")

# ── Constantes ────────────────────────────────────────────────────────────────
GOTENBERG_ENDPOINT = "/forms/chromium/convert/html"
DEFAULT_TIMEOUT    = 60.0   # segundos


async def html_to_pdf(
    html: str,
    paper_width:  float = 8.27,   # A4 en pulgadas
    paper_height: float = 11.69,
    margin_top:    float = 0.0,
    margin_bottom: float = 0.0,
    margin_left:   float = 0.0,
    margin_right:  float = 0.0,
    scale:         float = 1.0,
    print_background: bool = True,
) -> bytes:
    """
    Convierte un string HTML a PDF usando Gotenberg.

    Args:
        html:             Contenido HTML completo y autocontenido.
        paper_width/height: Dimensiones en pulgadas. A4 por defecto.
        margin_*:         Márgenes en pulgadas (el CSS del template ya maneja
                          el padding interno, por eso los márgenes son 0).
        scale:            Factor de escala (1.0 = 100%).
        print_background: Incluir fondos de color/imagen.

    Returns:
        Bytes del PDF generado.

    Raises:
        httpx.HTTPStatusError: Si Gotenberg devuelve error HTTP.
        httpx.ConnectError:    Si Gotenberg no está disponible.
    """
    url = f"{settings.GOTENBERG_URL}{GOTENBERG_ENDPOINT}"

    # Gotenberg recibe el HTML como archivo "index.html" en multipart
    files = {
        "files": ("index.html", html.encode("utf-8"), "text/html"),
    }

    data = {
        "paperWidth":       str(paper_width),
        "paperHeight":      str(paper_height),
        "marginTop":        str(margin_top),
        "marginBottom":     str(margin_bottom),
        "marginLeft":       str(margin_left),
        "marginRight":      str(margin_right),
        "scale":            str(scale),
        "printBackground":  "true" if print_background else "false",
        # Esperar a que la página esté idle antes de convertir
        # "waitUntil":        "networkidle0",
    }

    logger.info(
        "Enviando a Gotenberg | url=%s | html_bytes=%d",
        url, len(html.encode("utf-8")),
    )

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.post(url, files=files, data=data)

    response.raise_for_status()

    pdf_bytes = response.content
    logger.info(
        "PDF recibido de Gotenberg | pdf_bytes=%d",
        len(pdf_bytes),
    )
    return pdf_bytes


def get_paper_size(paper: str) -> tuple[float, float]:
    """
    Retorna (width_in, height_in) para el tamaño de papel dado.

    Tamaños soportados:
        A4       →  8.27 × 11.69
        Letter   →  8.5  × 11.0
        Legal    →  8.5  × 14.0
    """
    sizes: dict[str, tuple[float, float]] = {
        "A4":     (8.27, 11.69),
        "LETTER": (8.5,  11.0),
        "LEGAL":  (8.5,  14.0),
    }
    return sizes.get(paper.upper(), sizes["A4"])
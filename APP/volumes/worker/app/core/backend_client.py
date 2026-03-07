# core/backend_client.py
"""
Cliente HTTP del worker para comunicarse con el backend via API interna.

El worker NUNCA accede directamente a la base de datos.
Toda persistencia ocurre a través del backend usando este cliente.

Configuración (variables de entorno del worker):
    BACKEND_INTERNAL_URL    → http://minuetaitor-backend:8000  (default)
    INTERNAL_API_SECRET     → secret compartido con el backend
    BACKEND_TIMEOUT         → timeout en segundos (default: 30)
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from core.config import settings

logger = logging.getLogger(__name__)

# ── Constantes ────────────────────────────────────────────────────────────────
COMMIT_PATH = "/internal/v1/minutes/commit"


class BackendClientError(Exception):
    """Error al comunicarse con el backend interno."""
    def __init__(self, message: str, status_code: int | None = None, retryable: bool = True):
        super().__init__(message)
        self.status_code = status_code
        self.retryable   = retryable


def _build_headers() -> dict[str, str]:
    return {
        "Content-Type":    "application/json",
        "x-internal-secret": settings.INTERNAL_API_SECRET,
    }


def _do_request(path: str, body: dict) -> dict:
    """
    Ejecuta un POST HTTP hacia el backend interno.
    Usa urllib (stdlib) para evitar dependencias adicionales en el worker.
    """
    url     = f"{settings.BACKEND_INTERNAL_URL.rstrip('/')}{path}"
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = _build_headers()
    timeout = getattr(settings, "BACKEND_TIMEOUT", 30)

    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw  = resp.read()
            data = json.loads(raw.decode("utf-8"))
            logger.debug("Backend response | status=%d path=%s", resp.status, path)
            return data

    except urllib.error.HTTPError as e:
        raw  = e.read()
        body_str = raw.decode("utf-8", errors="replace")

        # 4xx → error de datos, no reintentable
        retryable = e.code >= 500
        logger.error(
            "Backend HTTP error | status=%d path=%s body=%s",
            e.code, path, body_str[:300],
        )
        raise BackendClientError(
            f"Backend retornó {e.code}: {body_str[:200]}",
            status_code=e.code,
            retryable=retryable,
        )

    except urllib.error.URLError as e:
        # Problemas de red — reintentable
        logger.error("Backend no alcanzable | path=%s error=%s", path, e.reason)
        raise BackendClientError(
            f"No se pudo conectar al backend: {e.reason}",
            retryable=True,
        )

    except Exception as e:
        logger.error("Error inesperado en backend client | path=%s: %s", path, e)
        raise BackendClientError(str(e), retryable=True)


def commit_tx2(
    transaction_id:    str,
    record_id:         str,
    requested_by_id:   str,
    ai_output:         dict[str, Any],
    openai_run_id:     str,
    tokens_input:      int,
    tokens_output:     int,
    input_objects_meta: list[dict],
    catalog_ids:       dict,
) -> dict:
    """
    Envía el resultado de OpenAI al backend para que persista TX2.

    Retorna el response dict del backend si todo OK.
    Lanza BackendClientError si falla (con retryable=True/False).
    """
    logger.info(
        "Enviando TX2 al backend | tx=%s record=%s tokens=%d/%d",
        transaction_id, record_id, tokens_input, tokens_output,
    )

    payload = {
        "transaction_id":    transaction_id,
        "record_id":         record_id,
        "requested_by_id":   requested_by_id,
        "ai_output":         ai_output,
        "openai_run_id":     openai_run_id,
        "tokens_input":      tokens_input,
        "tokens_output":     tokens_output,
        "input_objects_meta": input_objects_meta,
        "catalog_ids":       catalog_ids,
    }

    result = _do_request(COMMIT_PATH, payload)
    logger.info(
        "TX2 confirmada por backend | tx=%s version=%s",
        transaction_id,
        result.get("version_id", "?"),
    )
    return result
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
FAIL_PATH = "/internal/v1/minutes/fail"
ACTIVE_PROVIDER_PATH = "/internal/v1/minutes/active-provider"
NOTIFICATIONS_INGEST_PATH = "/internal/v1/notifications/ingest"


class BackendClientError(Exception):
    """Error al comunicarse con el backend interno."""
    def __init__(self, message: str, status_code: int | None = None, retryable: bool = True):
        super().__init__(message)
        self.status_code = status_code
        self.retryable   = retryable


def _extract_backend_error_message(raw_body: str) -> str | None:
    """
    Intenta obtener un mensaje legible desde el envelope estándar del backend.

    Soporta estructuras típicas como:
      {"error": {"message": "..."}}
      {"detail": {"message": "..."}}
      {"message": "..."}
    """
    body = str(raw_body or "").strip()
    if not body:
        return None

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return body[:200]

    if isinstance(payload, dict):
        error_obj = payload.get("error")
        if isinstance(error_obj, dict):
            message = str(error_obj.get("message") or "").strip()
            if message:
                return message

        detail_obj = payload.get("detail")
        if isinstance(detail_obj, dict):
            message = str(detail_obj.get("message") or detail_obj.get("error") or "").strip()
            if message:
                return message
        if isinstance(detail_obj, str) and detail_obj.strip():
            return detail_obj.strip()

        message = str(payload.get("message") or "").strip()
        if message:
            return message

    return body[:200]


def _build_headers() -> dict[str, str]:
    return {
        "Content-Type":    "application/json",
        "x-internal-secret": settings.INTERNAL_API_SECRET,
    }


def _unwrap_backend_success_payload(payload: Any) -> Any:
    """
    Desenvuelve el envelope estándar del backend cuando existe.

    El backend normalmente responde con:
      { success, status, result, error, meta }

    Para el worker nos interesa el contenido de `result`.
    Si el response no sigue ese contrato, devolvemos el payload original.
    """
    if not isinstance(payload, dict):
        return payload
    if "success" not in payload or "result" not in payload:
        return payload
    return payload.get("result")


def _do_request(path: str, body: dict | None = None, *, method: str = "POST") -> dict:
    """
    Ejecuta un request HTTP hacia el backend interno.
    Usa urllib (stdlib) para evitar dependencias adicionales en el worker.
    """
    url     = f"{settings.BACKEND_INTERNAL_URL.rstrip('/')}{path}"
    headers = _build_headers()
    timeout = getattr(settings, "BACKEND_TIMEOUT", 30)
    payload = None
    if body is not None:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw  = resp.read()
            data = json.loads(raw.decode("utf-8"))
            logger.debug("Backend response | status=%d path=%s", resp.status, path)
            return _unwrap_backend_success_payload(data)

    except urllib.error.HTTPError as e:
        raw  = e.read()
        body_str = raw.decode("utf-8", errors="replace")
        readable_message = _extract_backend_error_message(body_str)

        # 4xx → error de datos, no reintentable
        retryable = e.code >= 500
        logger.error(
            "Backend HTTP error | status=%d path=%s body=%s",
            e.code, path, body_str[:300],
        )
        raise BackendClientError(
            readable_message or f"El backend retornó HTTP {e.code}.",
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
    ai_input_schema:   dict[str, Any],
    derived_fields:    dict[str, Any],
    ai_provider:       str,
    ai_model:          str,
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
        "ai_input_schema":   ai_input_schema,
        "derived_fields":    derived_fields,
        "ai_provider":       ai_provider,
        "ai_model":          ai_model,
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


def get_active_ai_provider_config() -> dict[str, Any]:
    """
    Recupera desde el backend interno la configuración AI activa, con secretos
    resueltos para uso exclusivo del worker.
    """
    logger.info("Solicitando configuración AI activa al backend interno")
    return _do_request(ACTIVE_PROVIDER_PATH, method="GET")


def report_minute_failure(
    transaction_id: str,
    record_id: str,
    requested_by_id: str,
    error_message: str,
    *,
    record_status: str = "processing-error",
    source: str = "worker",
    openai_run_id: str | None = None,
) -> dict:
    """
    Reporta al backend un fallo terminal no reintentable para que actualice el
    estado funcional del record, publique SSE y cree notificación in-app.
    """
    logger.warning(
        "Reportando fallo terminal al backend | tx=%s record=%s record_status=%s",
        transaction_id, record_id, record_status,
    )
    payload = {
        "transaction_id": transaction_id,
        "record_id": record_id,
        "requested_by_id": requested_by_id,
        "error_message": error_message,
        "record_status": record_status,
        "source": source,
        "openai_run_id": openai_run_id,
    }
    return _do_request(FAIL_PATH, payload)


def ingest_notification(body: dict[str, Any]) -> dict:
    """
    Envía una notificación in-app ya resuelta al backend interno.
    Útil para eventos que nacen al final de jobs asíncronos del worker.
    """
    logger.info(
        "Enviando notificación interna | type=%s recipients=%s roles=%s",
        body.get("notificationType") or body.get("notification_type"),
        body.get("recipientUserIds") or body.get("recipient_user_ids"),
        body.get("roleCodes") or body.get("role_codes"),
    )
    return _do_request(NOTIFICATIONS_INGEST_PATH, body)

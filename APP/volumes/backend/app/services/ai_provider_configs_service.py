from __future__ import annotations

import base64
import hashlib
import hmac
import json
import socket
import ssl
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import HTTPException
from sqlalchemy import func, or_, text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session, joinedload

from core.config import settings
from core.datetime_utils import utc_now, utc_now_db
from core.exceptions import BadRequestException, ConflictException
from models.ai_provider_configs import AiProviderConfig
from schemas.ai_provider_configs import (
    AIProviderCatalogEntryResponse,
    AIProviderConfigCreateRequest,
    AIProviderConfigDiscoverModelsRequest,
    AIProviderConfigFilterRequest,
    AIProviderConfigUpdateRequest,
    AIProviderConfigValidateRequest,
    AUTH_TYPES,
    VALIDATION_STATUSES,
)
from services.ai_provider_catalog_service import (
    get_ai_commercial_provider_ids,
    get_ai_provider_catalog,
    get_ai_provider_definition,
)
from services.ai_provider_secrets import mask_secret, read_secret, store_secret

ACTIVE_LOCK_NAME = "ai_provider_configs_single_active"
ACTIVE_LOCK_TIMEOUT_SECONDS = 10
VALIDATION_TOKEN_TTL_SECONDS = 15 * 60
ANTHROPIC_VERSION = "2023-06-01"
TECHNICAL_FIELDS = {
    "provider_type",
    "base_url",
    "validation_endpoint",
    "models_endpoint",
    "model_name",
    "auth_type",
    "token_secret",
    "username",
    "password_secret",
    "custom_headers_json",
    "allow_model_discovery",
    "timeout_seconds",
}

def _utcnow() -> datetime:
    return utc_now()


def _is_missing_table_error(exc: Exception) -> bool:
    text_value = str(exc).lower()
    return (
        "ai_provider_configs" in text_value
        and ("doesn't exist" in text_value or "does not exist" in text_value or "no such table" in text_value)
    )


def ensure_ai_provider_config_schema_access(db: Session) -> None:
    db.query(AiProviderConfig.id).limit(1).first()


def _require_ai_schema(db: Session) -> None:
    try:
        ensure_ai_provider_config_schema_access(db)
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_table_error(exc):
            raise BadRequestException(
                "La tabla de configuraciones AI aún no está disponible. Aplica el esquema antes de administrar integraciones AI."
            )
        raise


def _user_ref(user_obj) -> dict[str, Any] | None:
    if not user_obj:
        return None
    return {
        "id": str(user_obj.id),
        "username": getattr(user_obj, "username", None),
        "full_name": getattr(user_obj, "full_name", None),
    }


def _parse_custom_headers(raw_value: str | None) -> dict[str, str] | None:
    if not raw_value:
        return None
    try:
        data = json.loads(raw_value)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    normalized: dict[str, str] = {}
    for key, value in data.items():
        clean_key = str(key or "").strip()
        clean_value = str(value or "").strip()
        if clean_key and clean_value:
            normalized[clean_key] = clean_value
    return normalized or None


def _provider_definition(provider_type: str | None) -> dict[str, Any]:
    return get_ai_provider_definition(provider_type) or {
        "id": str(provider_type or "").strip(),
        "label": str(provider_type or "").strip() or "Custom",
        "base_url": "",
        "validation_endpoint": "",
        "models_endpoint": "",
        "auth_type": "none",
        "provider_family": str(provider_type or "").strip() or "generic",
        "models_response_format": str(provider_type or "").strip() or "generic",
        "is_commercial": False,
    }


def _provider_family(provider_type: str | None) -> str:
    return str(_provider_definition(provider_type).get("provider_family") or "generic").strip() or "generic"


def _provider_models_response_format(provider_type: str | None) -> str:
    return str(_provider_definition(provider_type).get("models_response_format") or _provider_family(provider_type)).strip() or "generic"


def _provider_execution_adapter(provider_type: str | None) -> str:
    """
    Normaliza el protocolo de inferencia que entiende el worker.

    `custom` hoy cae en la familia `generic`, pero esa familia todavía no expone
    un selector explícito de protocolo conversacional. Mientras ese selector no
    exista, el worker debe tratar `generic` como `openai_compatible`, que es el
    contrato más amplio y estable dentro de los proveedores mantenidos.
    """
    family = _provider_family(provider_type)
    if family in {"openai_compatible", "anthropic", "ollama"}:
        return family
    return "openai_compatible"


def _build_response_dict(obj: AiProviderConfig) -> dict[str, Any]:
    token = read_secret(obj.token_secret)
    password = read_secret(obj.password_secret)
    return {
        "id": str(obj.id),
        "name": obj.name,
        "provider_type": obj.provider_type,
        "base_url": obj.base_url,
        "validation_endpoint": obj.validation_endpoint,
        "models_endpoint": obj.models_endpoint,
        "model_name": obj.model_name,
        "auth_type": obj.auth_type,
        "has_token": bool(token),
        "token_hint": mask_secret(token),
        "username": obj.username,
        "has_password": bool(password),
        "custom_headers": _parse_custom_headers(obj.custom_headers_json),
        "allow_model_discovery": bool(obj.allow_model_discovery),
        "is_active": bool(obj.is_active),
        "validation_status": obj.validation_status,
        "last_validated_at": obj.last_validated_at.isoformat() if obj.last_validated_at else None,
        "last_error": obj.last_error,
        "timeout_seconds": int(obj.timeout_seconds),
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        "created_by": _user_ref(obj.created_by_user),
        "updated_by": _user_ref(obj.updated_by_user),
        "last_validated_by": _user_ref(obj.last_validated_by_user),
    }


def _build_runtime_response_dict(obj: AiProviderConfig) -> dict[str, Any]:
    values = _config_values_from_obj(obj)
    return {
        "id": str(obj.id),
        "name": obj.name,
        "provider_type": obj.provider_type,
        "provider_family": _provider_family(obj.provider_type),
        "execution_adapter": _provider_execution_adapter(obj.provider_type),
        "base_url": obj.base_url,
        "model_name": obj.model_name,
        "auth_type": obj.auth_type,
        "token": read_secret(values.get("token_secret")),
        "username": obj.username,
        "password": read_secret(values.get("password_secret")),
        "custom_headers": _parse_custom_headers(obj.custom_headers_json),
        "timeout_seconds": int(obj.timeout_seconds),
        "validation_status": obj.validation_status,
    }


def _base_query(db: Session):
    return (
        db.query(AiProviderConfig)
        .options(
            joinedload(AiProviderConfig.created_by_user),
            joinedload(AiProviderConfig.updated_by_user),
            joinedload(AiProviderConfig.last_validated_by_user),
        )
        .filter(AiProviderConfig.deleted_at.is_(None))
    )


def _get_or_404(db: Session, config_id: str) -> AiProviderConfig:
    obj = _base_query(db).filter(AiProviderConfig.id == config_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_name(db: Session, name: str, exclude_id: str | None = None) -> None:
    q = db.query(AiProviderConfig).filter(
        AiProviderConfig.name == name,
        AiProviderConfig.deleted_at.is_(None),
    )
    if exclude_id:
        q = q.filter(AiProviderConfig.id != exclude_id)
    if db.query(q.exists()).scalar():
        raise HTTPException(status_code=409, detail="AI_PROVIDER_CONFIG_NAME_ALREADY_EXISTS")


def _config_values_from_obj(obj: AiProviderConfig) -> dict[str, Any]:
    return {
        "name": obj.name,
        "provider_type": obj.provider_type,
        "base_url": obj.base_url,
        "validation_endpoint": obj.validation_endpoint,
        "models_endpoint": obj.models_endpoint,
        "model_name": obj.model_name,
        "auth_type": obj.auth_type,
        "token_secret": obj.token_secret,
        "username": obj.username,
        "password_secret": obj.password_secret,
        "custom_headers_json": obj.custom_headers_json,
        "allow_model_discovery": bool(obj.allow_model_discovery),
        "is_active": bool(obj.is_active),
        "validation_status": obj.validation_status,
        "timeout_seconds": int(obj.timeout_seconds),
    }


def _validate_base_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise BadRequestException("La URL base debe iniciar con http:// o https:// y contener un host válido")
    return value.rstrip("/")


def _json_headers(value: dict[str, str] | None) -> str | None:
    if not value:
        return None
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"), sort_keys=True)


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _signature_payload(values: dict[str, Any]) -> dict[str, Any]:
    return {
        "provider_type": str(values.get("provider_type") or "").strip(),
        "base_url": str(values.get("base_url") or "").strip(),
        "validation_endpoint": str(values.get("validation_endpoint") or "").strip(),
        "models_endpoint": str(values.get("models_endpoint") or "").strip(),
        "model_name": str(values.get("model_name") or "").strip(),
        "auth_type": str(values.get("auth_type") or "").strip(),
        "token": str(read_secret(values.get("token_secret")) or "").strip(),
        "username": str(values.get("username") or "").strip(),
        "password": str(read_secret(values.get("password_secret")) or "").strip(),
        "custom_headers_json": str(values.get("custom_headers_json") or "").strip(),
        "allow_model_discovery": bool(values.get("allow_model_discovery")),
        "timeout_seconds": int(values.get("timeout_seconds") or 0),
    }


def _fingerprint_config(values: dict[str, Any]) -> str:
    payload = _signature_payload(values)
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _sign_payload(raw_payload: bytes) -> bytes:
    return hmac.new(
        settings.jwt_secret.encode("utf-8"),
        raw_payload,
        hashlib.sha256,
    ).digest()


def _issue_validation_token(values: dict[str, Any]) -> tuple[str, str]:
    expires_at = int(time.time()) + VALIDATION_TOKEN_TTL_SECONDS
    payload = {
        "fingerprint": _fingerprint_config(values),
        "exp": expires_at,
    }
    raw_payload = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    token = f"{_b64url_encode(raw_payload)}.{_b64url_encode(_sign_payload(raw_payload))}"
    expires_iso = datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat()
    return token, expires_iso


def _verify_validation_token(token: str, values: dict[str, Any]) -> None:
    try:
        payload_part, sig_part = token.split(".", 1)
        raw_payload = _b64url_decode(payload_part)
        raw_sig = _b64url_decode(sig_part)
        expected_sig = _sign_payload(raw_payload)
        if not hmac.compare_digest(raw_sig, expected_sig):
            raise BadRequestException("La validación de la configuración no es válida")
        payload = json.loads(raw_payload.decode("utf-8"))
    except BadRequestException:
        raise
    except Exception:
        raise BadRequestException("La validación de la configuración no es válida")

    exp = int(payload.get("exp") or 0)
    if exp < int(time.time()):
        raise BadRequestException("La validación expiró. Ejecuta la validación nuevamente.")

    expected_fingerprint = _fingerprint_config(values)
    if payload.get("fingerprint") != expected_fingerprint:
        raise BadRequestException("La configuración cambió después de validarla. Ejecuta la validación nuevamente.")


def _merge_effective_values(
    payload: dict[str, Any],
    existing: AiProviderConfig | None = None,
    *,
    require_model: bool = True,
) -> dict[str, Any]:
    values = _config_values_from_obj(existing) if existing else {}

    direct_fields = (
        "name",
        "provider_type",
        "base_url",
        "validation_endpoint",
        "models_endpoint",
        "model_name",
        "auth_type",
        "username",
        "allow_model_discovery",
        "is_active",
        "timeout_seconds",
    )
    for field in direct_fields:
        if field in payload:
            values[field] = payload.get(field)

    if "custom_headers" in payload:
        values["custom_headers_json"] = _json_headers(payload.get("custom_headers"))

    if existing is None or "token" in payload:
        values["token_secret"] = store_secret(payload.get("token"))
    if existing is None or "password" in payload:
        values["password_secret"] = store_secret(payload.get("password"))

    values["name"] = str(values.get("name") or "").strip()
    values["provider_type"] = str(values.get("provider_type") or "").strip()
    values["base_url"] = _validate_base_url(str(values.get("base_url") or "").strip())
    values["validation_endpoint"] = _normalize_endpoint(values.get("validation_endpoint"))
    values["models_endpoint"] = _normalize_endpoint(values.get("models_endpoint"))
    values["model_name"] = _normalize_optional_text(values.get("model_name"))
    values["auth_type"] = str(values.get("auth_type") or "").strip() or "none"
    values["username"] = _normalize_optional_text(values.get("username"))
    values["allow_model_discovery"] = bool(values.get("allow_model_discovery"))
    values["is_active"] = bool(values.get("is_active"))
    values["timeout_seconds"] = int(values.get("timeout_seconds") or 15)

    if values["auth_type"] != "api_key":
        values["token_secret"] = None
    if values["auth_type"] != "basic":
        values["username"] = None
        values["password_secret"] = None
    if values["auth_type"] != "custom_headers":
        values["custom_headers_json"] = None

    _validate_config_values(values, require_model=require_model)
    return values


def _normalize_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _normalize_endpoint(value: Any) -> str | None:
    normalized = _normalize_optional_text(value)
    if normalized is None:
        return None
    if normalized.startswith("http://") or normalized.startswith("https://"):
        return normalized.rstrip("/")
    return normalized


def _validate_config_values(values: dict[str, Any], *, require_model: bool = True) -> None:
    if not values["name"]:
        raise BadRequestException("El nombre interno es obligatorio")
    if not get_ai_provider_definition(values["provider_type"]):
        raise BadRequestException("El tipo de proveedor AI es inválido")
    if values["auth_type"] not in AUTH_TYPES:
        raise BadRequestException("El tipo de autenticación es inválido")
    if values["timeout_seconds"] < 1 or values["timeout_seconds"] > 120:
        raise BadRequestException("El timeout debe estar entre 1 y 120 segundos")

    token = read_secret(values.get("token_secret"))
    password = read_secret(values.get("password_secret"))
    custom_headers = _parse_custom_headers(values.get("custom_headers_json"))

    if values["provider_type"] in get_ai_commercial_provider_ids():
        if values["auth_type"] != "api_key":
            raise BadRequestException("Los proveedores comerciales deben usar autenticación por API Key")
        if not token:
            raise BadRequestException("La API Key es obligatoria para el proveedor seleccionado")

    if values["auth_type"] == "api_key" and not token and values["provider_type"] not in {"ollama_local", "ollama_remote"}:
        raise BadRequestException("Debes ingresar un token o API Key para esta configuración")

    if values["auth_type"] == "basic":
        if not values.get("username") or not password:
            raise BadRequestException("La autenticación básica requiere usuario y contraseña")

    if values["auth_type"] == "custom_headers" and not custom_headers:
        raise BadRequestException("Debes ingresar al menos un header personalizado")

    if require_model and not values.get("model_name"):
        raise BadRequestException("Debes indicar un modelo antes de validar y guardar la configuración")

    if values["is_active"] and not values.get("model_name"):
        raise BadRequestException("No puedes activar una configuración AI sin modelo configurado")


def _default_validation_endpoint(provider_type: str) -> str | None:
    return _provider_definition(provider_type).get("validation_endpoint") or None


def _default_models_endpoint(provider_type: str) -> str | None:
    return _provider_definition(provider_type).get("models_endpoint") or None


def _build_request_headers(values: dict[str, Any]) -> dict[str, str]:
    headers = {
        "Accept": "application/json",
    }

    custom_headers = _parse_custom_headers(values.get("custom_headers_json")) or {}
    headers.update(custom_headers)

    token = read_secret(values.get("token_secret"))
    password = read_secret(values.get("password_secret"))
    username = values.get("username")
    auth_type = values.get("auth_type")
    provider_type = values.get("provider_type")
    provider_family = _provider_family(provider_type)

    if auth_type == "api_key" and token:
        if provider_family == "anthropic":
            headers["x-api-key"] = token
            headers.setdefault("anthropic-version", ANTHROPIC_VERSION)
        else:
            headers["Authorization"] = f"Bearer {token}"
    elif auth_type == "basic" and username and password:
        raw_value = f"{username}:{password}".encode("utf-8")
        headers["Authorization"] = f"Basic {base64.b64encode(raw_value).decode('utf-8')}"

    if provider_family == "anthropic":
        headers.setdefault("anthropic-version", ANTHROPIC_VERSION)

    return headers


def _resolve_url(base_url: str, endpoint: str | None) -> str | None:
    if not endpoint:
        return None
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    return f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"


def _sanitize_remote_error(message: str) -> str:
    lowered = str(message or "").strip().lower()
    if not lowered:
        return "La validación remota falló."
    if "timed out" in lowered or "timeout" in lowered:
        return "La validación excedió el tiempo de espera configurado."
    if "name or service not known" in lowered or "temporary failure in name resolution" in lowered:
        return "No fue posible resolver el host configurado."
    if "connection refused" in lowered:
        return "El servidor rechazó la conexión."
    if "unauthorized" in lowered or "forbidden" in lowered:
        return "Las credenciales no fueron aceptadas por el proveedor."
    return "La validación remota no pudo completarse con los datos proporcionados."


def _mark_validation_result(
    db: Session,
    obj: AiProviderConfig,
    *,
    status: str,
    message: str,
    validated_by_id: str,
) -> dict[str, Any]:
    obj.validation_status = status
    obj.last_validated_at = utc_now_db()
    obj.last_validated_by = validated_by_id
    obj.last_error = None if status == "valid" else message
    obj.updated_by = validated_by_id
    db.commit()
    db.refresh(obj)
    refreshed = _get_or_404(db, obj.id)
    return {
        "ok": status == "valid",
        "status": status,
        "message": message,
        "last_validated_at": refreshed.last_validated_at.isoformat() if refreshed.last_validated_at else None,
        "config": _build_response_dict(refreshed),
    }


def _effective_validation_url(values: dict[str, Any]) -> str | None:
    base_url = values["base_url"]
    endpoint = values.get("validation_endpoint") or _default_validation_endpoint(values["provider_type"])

    if values["provider_type"] == "custom" and not endpoint:
        if values.get("allow_model_discovery"):
            endpoint = values.get("models_endpoint")
        else:
            return None

    return _resolve_url(base_url, endpoint)


def _effective_models_url(values: dict[str, Any]) -> str | None:
    base_url = values["base_url"]
    endpoint = values.get("models_endpoint") or _default_models_endpoint(values["provider_type"])
    if values["provider_type"] == "custom" and not endpoint:
        return None
    return _resolve_url(base_url, endpoint)


def _extract_model_options(provider_type: str, payload: Any) -> list[dict[str, str]]:
    options: list[dict[str, str]] = []
    response_format = _provider_models_response_format(provider_type)

    def add_option(raw_value: Any, raw_label: Any = None) -> None:
        value = _normalize_optional_text(raw_value)
        if not value:
            return
        label = _normalize_optional_text(raw_label) or value
        option = {"value": value, "label": label}
        if option not in options:
            options.append(option)

    if response_format == "openai":
        for item in payload.get("data", []) if isinstance(payload, dict) else []:
            if isinstance(item, dict):
                add_option(item.get("id"))
    elif response_format == "anthropic":
        for item in payload.get("data", []) if isinstance(payload, dict) else []:
            if isinstance(item, dict):
                add_option(item.get("id"), item.get("display_name"))
    elif response_format == "ollama":
        for item in payload.get("models", []) if isinstance(payload, dict) else []:
            if isinstance(item, dict):
                add_option(item.get("model") or item.get("name"))
    else:
        if isinstance(payload, dict):
            for item in payload.get("data", []) or payload.get("models", []) or []:
                if isinstance(item, dict):
                    add_option(item.get("id") or item.get("model") or item.get("name"), item.get("display_name") or item.get("name"))
                else:
                    add_option(item)

    return options


def _fetch_remote_json(url: str, values: dict[str, Any]) -> Any:
    request = Request(
        url,
        method="GET",
        headers=_build_request_headers(values),
    )
    context = ssl.create_default_context() if url.startswith("https://") else None
    with urlopen(request, timeout=int(values["timeout_seconds"]), context=context) as response:
        raw_body = response.read().decode("utf-8")
    return json.loads(raw_body) if raw_body else {}


def _discover_model_options(values: dict[str, Any]) -> dict[str, Any]:
    endpoint_used = _effective_models_url(values)
    if not endpoint_used:
        raise BadRequestException("Debes configurar un endpoint de modelos para recuperar la lista disponible")

    try:
        payload = _fetch_remote_json(endpoint_used, values)
    except HTTPError as exc:
        if exc.code in {401, 403}:
            raise BadRequestException("Las credenciales configuradas fueron rechazadas al consultar los modelos disponibles")
        if exc.code == 404:
            raise BadRequestException("El endpoint de modelos no está disponible o no existe")
        if 500 <= exc.code <= 599:
            raise BadRequestException("El proveedor respondió con un error temporal al consultar los modelos")
        raise BadRequestException(f"La consulta de modelos respondió con estado HTTP {exc.code}")
    except TimeoutError:
        raise BadRequestException("La consulta de modelos excedió el tiempo de espera configurado")
    except URLError as exc:
        reason = getattr(exc, "reason", exc)
        raise BadRequestException(_sanitize_remote_error(str(reason)))
    except (socket.gaierror, socket.timeout, OSError) as exc:
        raise BadRequestException(_sanitize_remote_error(str(exc)))
    except json.JSONDecodeError:
        raise BadRequestException("El endpoint de modelos respondió, pero no devolvió un JSON válido")

    items = _extract_model_options(values["provider_type"], payload)
    if not items:
        raise BadRequestException("No se encontraron modelos disponibles en el endpoint configurado")
    return {
        "items": items,
        "endpoint_used": endpoint_used,
    }


def _discover_model_options_from_payload(
    values: dict[str, Any],
    *,
    payload: Any,
    endpoint_used: str | None,
) -> dict[str, Any]:
    items = _extract_model_options(values["provider_type"], payload)
    if not items:
        raise BadRequestException("No se encontraron modelos disponibles en el endpoint configurado")
    return {
        "items": items,
        "endpoint_used": endpoint_used,
    }


def _validation_status_from_discovery_error(message: str) -> str:
    lowered = str(message or "").lower()
    if "credenciales" in lowered or "api key" in lowered or "token" in lowered:
        return "auth_error"
    if "tiempo de espera" in lowered or "timeout" in lowered:
        return "timeout"
    if "endpoint" in lowered and ("no está disponible" in lowered or "no existe" in lowered):
        return "endpoint_unavailable"
    if "host" in lowered or "conexión" in lowered or "servidor" in lowered:
        return "connection_error"
    return "error"


def _validate_selected_model(
    values: dict[str, Any],
    *,
    discovered: dict[str, Any] | None = None,
) -> tuple[str, str]:
    model_name = _normalize_optional_text(values.get("model_name"))
    if not model_name:
        return ("error", "Debes indicar un modelo para validar esta configuración.")

    if not _effective_models_url(values):
        return (
            "valid",
            f"Validación correcta. Se confirmó la configuración mínima y se mantuvo el modelo '{model_name}' como valor manual.",
        )

    if discovered is None:
        try:
            discovered = _discover_model_options(values)
        except BadRequestException as exc:
            message = str(exc)
            return (_validation_status_from_discovery_error(message), message)

    discovered_values = {item["value"] for item in discovered.get("items", [])}
    if model_name not in discovered_values:
        return (
            "error",
            f"El modelo '{model_name}' no fue encontrado en el endpoint de modelos configurado.",
        )

    endpoint_used = discovered.get("endpoint_used")
    if endpoint_used:
        return (
            "valid",
            f"Validación correcta. El modelo '{model_name}' está disponible en {endpoint_used}.",
        )
    return ("valid", f"Validación correcta. El modelo '{model_name}' está disponible.")


def _run_remote_validation(values: dict[str, Any]) -> tuple[str, str, Any | None, str | None]:
    validation_url = _effective_validation_url(values)
    if not validation_url:
        return (
            "valid",
            "Configuración mínima coherente. No se definió un endpoint remoto de validación, por lo que solo se verificó la consistencia básica.",
            None,
            None,
        )

    request = Request(
        validation_url,
        method="GET",
        headers=_build_request_headers(values),
    )
    context = ssl.create_default_context() if validation_url.startswith("https://") else None
    timeout_seconds = int(values["timeout_seconds"])

    try:
        with urlopen(request, timeout=timeout_seconds, context=context) as response:
            status_code = int(getattr(response, "status", 200))
            raw_body = response.read().decode("utf-8")
            payload = json.loads(raw_body) if raw_body else {}
            if 200 <= status_code < 300:
                return (
                    "valid",
                    f"Validación correcta. El endpoint respondió satisfactoriamente en {validation_url}.",
                    payload,
                    validation_url,
                )
            return (
                "error",
                "El proveedor respondió, pero no confirmó la configuración como válida.",
                None,
                validation_url,
            )
    except HTTPError as exc:
        if exc.code in {401, 403}:
            return ("auth_error", "Las credenciales configuradas fueron rechazadas por el proveedor.", None, validation_url)
        if exc.code == 404:
            return ("endpoint_unavailable", "El endpoint de validación no está disponible o no existe.", None, validation_url)
        if 500 <= exc.code <= 599:
            return ("endpoint_unavailable", "El proveedor respondió con un error temporal del servidor.", None, validation_url)
        return ("error", f"La validación remota respondió con estado HTTP {exc.code}.", None, validation_url)
    except TimeoutError:
        return ("timeout", "La validación excedió el tiempo de espera configurado.", None, validation_url)
    except URLError as exc:
        reason = getattr(exc, "reason", exc)
        if isinstance(reason, socket.timeout):
            return ("timeout", "La validación excedió el tiempo de espera configurado.", None, validation_url)
        return ("connection_error", _sanitize_remote_error(str(reason)), None, validation_url)
    except (socket.gaierror, socket.timeout, OSError) as exc:
        return ("connection_error", _sanitize_remote_error(str(exc)), None, validation_url)
    except json.JSONDecodeError:
        return ("error", "El endpoint de validación respondió, pero no devolvió un JSON válido.", None, validation_url)


def _run_validation_pipeline(values: dict[str, Any]) -> tuple[str, str]:
    status, message, validation_payload, validation_url = _run_remote_validation(values)
    if status != "valid":
        return status, message

    discovered = None
    models_url = _effective_models_url(values)
    if validation_payload is not None and validation_url and models_url and validation_url == models_url:
        try:
            discovered = _discover_model_options_from_payload(
                values,
                payload=validation_payload,
                endpoint_used=models_url,
            )
        except BadRequestException as exc:
            message = str(exc)
            return _validation_status_from_discovery_error(message), message

    model_status, model_message = _validate_selected_model(values, discovered=discovered)
    if model_status != "valid":
        return model_status, model_message

    if "modelo" in model_message.lower():
        return status, f"{message} {model_message}"
    return status, message


def _has_technical_changes(existing: AiProviderConfig, values: dict[str, Any]) -> bool:
    current = _config_values_from_obj(existing)
    next_values = {
        **current,
        **values,
    }
    for field in TECHNICAL_FIELDS:
        if current.get(field) != next_values.get(field):
            return True
    return False


@contextmanager
def _active_config_lock(db: Session):
    acquired = False
    try:
        result = db.execute(
            text("SELECT GET_LOCK(:name, :timeout)"),
            {"name": ACTIVE_LOCK_NAME, "timeout": ACTIVE_LOCK_TIMEOUT_SECONDS},
        )
        acquired = bool((result.scalar() or 0) == 1)
        if not acquired:
            raise ConflictException("No fue posible reservar la activación exclusiva. Intenta nuevamente.")
        yield
    finally:
        if acquired:
            db.execute(text("SELECT RELEASE_LOCK(:name)"), {"name": ACTIVE_LOCK_NAME})


@contextmanager
def _optional_active_config_lock(db: Session, should_lock: bool):
    if should_lock:
        with _active_config_lock(db):
            yield
        return
    yield


def _deactivate_other_configs(db: Session, keep_id: str | None, updated_by_id: str | None) -> None:
    items = (
        db.query(AiProviderConfig)
        .filter(AiProviderConfig.deleted_at.is_(None), AiProviderConfig.is_active.is_(True))
        .all()
    )
    for item in items:
        if keep_id and item.id == keep_id:
            continue
        item.is_active = False
        item.updated_by = updated_by_id


def _reset_validation_state(obj: AiProviderConfig) -> None:
    obj.validation_status = "unvalidated"
    obj.last_validated_at = None
    obj.last_validated_by = None
    obj.last_error = None


def get_ai_provider_config(db: Session, config_id: str) -> dict[str, Any]:
    _require_ai_schema(db)
    return _build_response_dict(_get_or_404(db, config_id))


def get_active_ai_provider_runtime_config(db: Session) -> dict[str, Any]:
    _require_ai_schema(db)
    obj = (
        db.query(AiProviderConfig)
        .filter(AiProviderConfig.deleted_at.is_(None), AiProviderConfig.is_active.is_(True))
        .order_by(AiProviderConfig.updated_at.desc(), AiProviderConfig.created_at.desc())
        .first()
    )
    if not obj:
        raise BadRequestException(
            "No existe una configuración AI activa. Activa una integración válida en Sistema > Integraciones > IA."
        )
    if str(obj.validation_status or "").strip() != "valid":
        raise BadRequestException(
            "La configuración AI activa no está validada. Valídala antes de procesar minutas."
        )
    if not str(obj.model_name or "").strip():
        raise BadRequestException("La configuración AI activa no tiene modelo configurado.")
    return _build_runtime_response_dict(obj)


def list_ai_provider_catalog() -> list[dict[str, Any]]:
    try:
        catalog_items = get_ai_provider_catalog()
    except Exception:
        return []

    normalized_items: list[dict[str, Any]] = []
    for item in catalog_items:
        if not isinstance(item, dict):
            continue
        try:
            normalized_entry = AIProviderCatalogEntryResponse.model_validate(
                {
                    "id": str(item.get("id") or "").strip(),
                    "label": str(item.get("label") or item.get("id") or "").strip(),
                    "base_url": str(item.get("base_url") or "").strip(),
                    "validation_endpoint": str(item.get("validation_endpoint") or "").strip(),
                    "models_endpoint": str(item.get("models_endpoint") or "").strip(),
                    "auth_type": str(item.get("auth_type") or "none").strip() or "none",
                    "provider_family": str(item.get("provider_family") or item.get("id") or "generic").strip() or "generic",
                    "models_response_format": str(
                        item.get("models_response_format") or item.get("provider_family") or item.get("id") or "generic"
                    ).strip() or "generic",
                    "is_commercial": bool(item.get("is_commercial")),
                }
            )
            normalized_items.append(normalized_entry.model_dump())
        except Exception:
            continue

    return normalized_items


def list_ai_provider_configs(db: Session, filters: AIProviderConfigFilterRequest) -> dict[str, Any]:
    try:
        ensure_ai_provider_config_schema_access(db)
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_table_error(exc):
            return {
                "items": [],
                "total": 0,
                "skip": int(filters.skip),
                "limit": int(filters.limit),
            }
        raise

    q = _base_query(db)

    if filters.is_active is not None:
        q = q.filter(AiProviderConfig.is_active.is_(bool(filters.is_active)))
    if filters.provider_type:
        q = q.filter(AiProviderConfig.provider_type == filters.provider_type)
    if filters.validation_status:
        q = q.filter(AiProviderConfig.validation_status == filters.validation_status)
    if filters.search:
        like = f"%{filters.search}%"
        q = q.filter(
            or_(
                AiProviderConfig.name.ilike(like),
                AiProviderConfig.base_url.ilike(like),
                AiProviderConfig.model_name.ilike(like),
            )
        )

    total = q.with_entities(func.count(AiProviderConfig.id)).scalar() or 0
    items = (
        q.order_by(
            AiProviderConfig.is_active.desc(),
            AiProviderConfig.updated_at.desc(),
            AiProviderConfig.created_at.desc(),
        )
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(item) for item in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def create_ai_provider_config(db: Session, body: AIProviderConfigCreateRequest, created_by_id: str) -> dict[str, Any]:
    _require_ai_schema(db)
    payload = body.model_dump(exclude_unset=True)
    values = _merge_effective_values(payload, existing=None)
    _verify_validation_token(body.validation_token, values)
    _check_unique_name(db, values["name"])
    validated_at = utc_now_db()

    with _optional_active_config_lock(db, bool(values["is_active"])):
        if values["is_active"]:
            _deactivate_other_configs(db, keep_id=None, updated_by_id=created_by_id)

        obj = AiProviderConfig(
            id=str(uuid.uuid4()),
            name=values["name"],
            provider_type=values["provider_type"],
            base_url=values["base_url"],
            validation_endpoint=values.get("validation_endpoint"),
            models_endpoint=values.get("models_endpoint"),
            model_name=values.get("model_name"),
            auth_type=values["auth_type"],
            token_secret=values.get("token_secret"),
            username=values.get("username"),
            password_secret=values.get("password_secret"),
            custom_headers_json=values.get("custom_headers_json"),
            allow_model_discovery=bool(values.get("allow_model_discovery")),
            is_active=bool(values.get("is_active")),
            validation_status="valid",
            last_validated_at=validated_at,
            last_validated_by=created_by_id,
            last_error=None,
            timeout_seconds=int(values["timeout_seconds"]),
            created_by=created_by_id,
            updated_by=created_by_id,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
    return _build_response_dict(_get_or_404(db, obj.id))


def update_ai_provider_config(
    db: Session,
    config_id: str,
    body: AIProviderConfigUpdateRequest,
    updated_by_id: str,
) -> dict[str, Any]:
    _require_ai_schema(db)
    obj = _get_or_404(db, config_id)
    payload = body.model_dump(exclude_unset=True)
    values = _merge_effective_values(payload, existing=obj)
    _verify_validation_token(body.validation_token, values)
    _check_unique_name(db, values["name"], exclude_id=obj.id)
    validated_at = utc_now_db()
    should_lock_active_scope = bool(values["is_active"]) or bool(obj.is_active)

    with _optional_active_config_lock(db, should_lock_active_scope):
        if values["is_active"]:
            _deactivate_other_configs(db, keep_id=obj.id, updated_by_id=updated_by_id)

        obj.name = values["name"]
        obj.provider_type = values["provider_type"]
        obj.base_url = values["base_url"]
        obj.validation_endpoint = values.get("validation_endpoint")
        obj.models_endpoint = values.get("models_endpoint")
        obj.model_name = values.get("model_name")
        obj.auth_type = values["auth_type"]
        obj.token_secret = values.get("token_secret")
        obj.username = values.get("username")
        obj.password_secret = values.get("password_secret")
        obj.custom_headers_json = values.get("custom_headers_json")
        obj.allow_model_discovery = bool(values.get("allow_model_discovery"))
        if "is_active" in payload:
            obj.is_active = bool(values.get("is_active"))
        obj.timeout_seconds = int(values["timeout_seconds"])
        obj.updated_by = updated_by_id
        obj.validation_status = "valid"
        obj.last_validated_at = validated_at
        obj.last_validated_by = updated_by_id
        obj.last_error = None

        db.commit()
        db.refresh(obj)
    return _build_response_dict(_get_or_404(db, obj.id))


def activate_ai_provider_config(db: Session, config_id: str, updated_by_id: str) -> dict[str, Any]:
    _require_ai_schema(db)
    obj = _get_or_404(db, config_id)
    if not _normalize_optional_text(obj.model_name):
        raise BadRequestException("No puedes activar una configuración AI sin modelo configurado")
    if obj.validation_status != "valid":
        raise BadRequestException("Solo puedes activar una configuración AI que ya fue validada correctamente")

    with _active_config_lock(db):
        _deactivate_other_configs(db, keep_id=obj.id, updated_by_id=updated_by_id)
        obj.is_active = True
        obj.updated_by = updated_by_id
        db.commit()
        db.refresh(obj)
    return _build_response_dict(_get_or_404(db, obj.id))


def deactivate_ai_provider_config(db: Session, config_id: str, updated_by_id: str) -> dict[str, Any]:
    _require_ai_schema(db)
    obj = _get_or_404(db, config_id)
    with _active_config_lock(db):
        obj.is_active = False
        obj.updated_by = updated_by_id
        db.commit()
        db.refresh(obj)
    return _build_response_dict(_get_or_404(db, obj.id))


def validate_ai_provider_config(
    db: Session,
    body: AIProviderConfigValidateRequest,
    validated_by_id: str,
) -> dict[str, Any]:
    current = None
    payload = body.model_dump(exclude_unset=True)
    config_id = payload.get("config_id")

    if config_id:
        _require_ai_schema(db)
        current = _get_or_404(db, config_id)

    if not current and not payload:
        raise BadRequestException("Debes indicar una configuración AI para validar")

    values = _merge_effective_values(payload, existing=current)

    try:
        _validate_config_values(values)
    except BadRequestException as exc:
        if current and len(payload) == 1 and config_id:
            return _mark_validation_result(
                db,
                current,
                status="error",
                message=exc.message,
                validated_by_id=validated_by_id,
            )
        return {
            "ok": False,
            "status": "error",
            "message": exc.message,
            "last_validated_at": None,
            "validation_token": None,
            "expires_at": None,
            "config": _build_response_dict(current) if current else None,
        }

    status, message = _run_validation_pipeline(values)
    if status not in VALIDATION_STATUSES:
        status = "error"

    if current and len(payload) == 1 and config_id:
        result = _mark_validation_result(
            db,
            current,
            status=status,
            message=message,
            validated_by_id=validated_by_id,
        )
        if result["ok"]:
            validation_token, expires_at = _issue_validation_token(values)
            result["validation_token"] = validation_token
            result["expires_at"] = expires_at
        else:
            result["validation_token"] = None
            result["expires_at"] = None
        return result

    validation_token = None
    expires_at = None
    last_validated_at = None
    if status == "valid":
        validation_token, expires_at = _issue_validation_token(values)
        last_validated_at = _utcnow().isoformat()

    return {
        "ok": status == "valid",
        "status": status,
        "message": message,
        "last_validated_at": last_validated_at,
        "validation_token": validation_token,
        "expires_at": expires_at,
        "config": _build_response_dict(current) if current else None,
    }


def delete_ai_provider_config(db: Session, config_id: str, deleted_by_id: str) -> dict[str, Any]:
    _require_ai_schema(db)
    obj = _get_or_404(db, config_id)

    with _active_config_lock(db):
        obj.deleted_at = utc_now_db()
        obj.deleted_by = deleted_by_id
        obj.updated_by = deleted_by_id
        obj.is_active = False
        db.commit()

    return {"ok": True}


def discover_ai_provider_models(db: Session, body: AIProviderConfigDiscoverModelsRequest) -> dict[str, Any]:
    if body.config_id:
        _require_ai_schema(db)
    current = _get_or_404(db, body.config_id) if body.config_id else None
    payload = body.model_dump(exclude_unset=True)
    values = _merge_effective_values(payload, existing=current, require_model=False)
    return _discover_model_options(values)

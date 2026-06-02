from __future__ import annotations

import json
import socket
import ssl
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session, joinedload

from core.datetime_utils import utc_now_db
from core.exceptions import BadRequestException, ConflictException
from models.ai_provider_bindings import AiProviderBinding
from models.ai_provider_configs import AiProviderConfig
from models.ai_context_sync import AiContextDocument
from schemas.ai_provider_bindings import (
    AI_PROVIDER_BINDING_PURPOSES,
    AIProviderBindingUpsertRequest,
)
from services.ai_provider_configs_service import _build_runtime_response_dict

PURPOSE_MINUTE_ANALYSIS = "minute_analysis"
PURPOSE_CONTEXT_EMBEDDINGS = "context_embeddings"
PURPOSE_CONTEXT_ANSWERING = "context_answering"

PURPOSE_LABELS = {
    PURPOSE_MINUTE_ANALYSIS: "análisis de minutas",
    PURPOSE_CONTEXT_EMBEDDINGS: "vectorización de contexto",
    PURPOSE_CONTEXT_ANSWERING: "respuesta contextual",
}


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _user_ref(user) -> dict | None:
    if not user:
        return None
    return {
        "id": user.id,
        "username": getattr(user, "username", None),
        "full_name": getattr(user, "full_name", None),
    }


def _provider_ref(provider: AiProviderConfig | None) -> dict | None:
    if not provider:
        return None
    return {
        "id": provider.id,
        "name": provider.name,
        "provider_type": provider.provider_type,
        "validation_status": provider.validation_status,
        "is_active": bool(provider.is_active),
    }


def _base_query(db: Session):
    return (
        db.query(AiProviderBinding)
        .options(
            joinedload(AiProviderBinding.provider_config),
            joinedload(AiProviderBinding.created_by_user),
            joinedload(AiProviderBinding.updated_by_user),
        )
        .filter(AiProviderBinding.deleted_at.is_(None))
    )


def _build_response_dict(obj: AiProviderBinding) -> dict:
    return {
        "id": obj.id,
        "purpose": obj.purpose,
        "provider_config_id": obj.provider_config_id,
        "model_name": obj.model_name,
        "embedding_dimensions": obj.embedding_dimensions,
        "is_active": bool(obj.is_active),
        "provider": _provider_ref(obj.provider_config),
        "created_at": _iso(obj.created_at),
        "updated_at": _iso(obj.updated_at),
        "created_by": _user_ref(obj.created_by_user),
        "updated_by": _user_ref(obj.updated_by_user),
    }


def _normalize_purpose(purpose: str) -> str:
    cleaned = str(purpose or "").strip()
    if cleaned not in AI_PROVIDER_BINDING_PURPOSES:
        raise BadRequestException("Propósito de uso IA inválido.")
    return cleaned


def _get_provider_or_error(db: Session, provider_config_id: str) -> AiProviderConfig:
    provider = (
        db.query(AiProviderConfig)
        .filter(AiProviderConfig.id == provider_config_id, AiProviderConfig.deleted_at.is_(None))
        .first()
    )
    if not provider:
        raise BadRequestException("La configuración AI seleccionada no existe.")
    if not bool(provider.is_active):
        raise BadRequestException("La configuración AI seleccionada debe estar activa.")
    if str(provider.validation_status or "").strip() != "valid":
        raise BadRequestException("La configuración AI seleccionada debe estar validada.")
    return provider


def _embedding_validation_headers(provider: dict[str, Any]) -> dict[str, str]:
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    custom_headers = provider.get("custom_headers") or {}
    if isinstance(custom_headers, dict):
        headers.update({str(key): str(value) for key, value in custom_headers.items() if key and value})

    token = str(provider.get("token") or "").strip()
    if str(provider.get("auth_type") or "") == "api_key" and token:
        if str(provider.get("provider_family") or "") == "anthropic":
            headers["x-api-key"] = token
            headers.setdefault("anthropic-version", "2023-06-01")
        else:
            headers["Authorization"] = f"Bearer {token}"

    return headers


def _embedding_validation_request(
    url: str,
    *,
    body: dict[str, Any],
    headers: dict[str, str],
    timeout: int,
) -> dict[str, Any]:
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    context = ssl.create_default_context() if url.startswith("https://") else None
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        detail = raw[:300].strip()
        suffix = f": {detail}" if detail else ""
        raise BadRequestException(
            f"No se pudo validar el modelo de embeddings. El provider respondió HTTP {exc.code}{suffix}"
        ) from exc
    except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
        raise BadRequestException(
            f"No se pudo conectar al provider para validar las dimensiones del modelo de embeddings: {exc}"
        ) from exc


def _probe_embedding_dimensions(provider: AiProviderConfig, model_name: str) -> int:
    runtime = _build_runtime_response_dict(provider)
    family = str(runtime.get("provider_family") or runtime.get("execution_adapter") or "openai_compatible")
    base_url = str(runtime.get("base_url") or "").rstrip("/")
    timeout = int(runtime.get("timeout_seconds") or 60)
    headers = _embedding_validation_headers(runtime)
    probe_text = "dimension check"

    if not base_url:
        raise BadRequestException("El provider AI seleccionado no tiene URL base configurada.")

    if family == "ollama":
        response = _embedding_validation_request(
            f"{base_url}/api/embeddings",
            body={"model": model_name, "prompt": probe_text},
            headers=headers,
            timeout=timeout,
        )
        vector = response.get("embedding")
    else:
        response = _embedding_validation_request(
            f"{base_url}/embeddings",
            body={"model": model_name, "input": [probe_text]},
            headers=headers,
            timeout=timeout,
        )
        data = response.get("data") or []
        first_item = data[0] if data else {}
        vector = first_item.get("embedding") if isinstance(first_item, dict) else None

    if not isinstance(vector, list) or not vector:
        raise BadRequestException(
            "El provider no devolvió un vector de embeddings válido para el modelo seleccionado."
        )

    return len(vector)


def _validate_embedding_dimensions(provider: AiProviderConfig, model_name: str, expected_dimensions: int) -> None:
    actual_dimensions = _probe_embedding_dimensions(provider, model_name)
    if actual_dimensions != int(expected_dimensions or 0):
        raise BadRequestException(
            "Las dimensiones configuradas no coinciden con el modelo seleccionado. "
            f"El provider devolvió {actual_dimensions} dimensiones y la configuración indica "
            f"{int(expected_dimensions or 0)}. Ajusta las dimensiones a {actual_dimensions} "
            "o selecciona otro modelo de embeddings."
        )


def list_ai_provider_bindings(db: Session) -> dict:
    items = (
        _base_query(db)
        .filter(AiProviderBinding.is_active.is_(True))
        .order_by(AiProviderBinding.purpose.asc(), AiProviderBinding.updated_at.desc())
        .all()
    )
    return {"items": [_build_response_dict(item) for item in items]}


def upsert_ai_provider_binding(
    db: Session,
    body: AIProviderBindingUpsertRequest,
    *,
    updated_by_id: str,
) -> dict:
    purpose = _normalize_purpose(body.purpose)
    provider = _get_provider_or_error(db, body.provider_config_id)
    model_name = str(body.model_name or "").strip()
    if not model_name:
        raise BadRequestException("Debes seleccionar un modelo para este propósito.")

    embedding_dimensions = body.embedding_dimensions
    if purpose == PURPOSE_CONTEXT_EMBEDDINGS and not embedding_dimensions:
        raise BadRequestException("Debes indicar las dimensiones del modelo de embeddings.")
    if purpose != PURPOSE_CONTEXT_EMBEDDINGS:
        embedding_dimensions = None
    else:
        _validate_embedding_dimensions(provider, model_name, int(embedding_dimensions or 0))

    now = utc_now_db()
    active_items = (
        db.query(AiProviderBinding)
        .filter(
            AiProviderBinding.purpose == purpose,
            AiProviderBinding.is_active.is_(True),
            AiProviderBinding.deleted_at.is_(None),
        )
        .all()
    )

    target = next((item for item in active_items if item.provider_config_id == provider.id), None)
    previous_active = next((item for item in active_items if item.is_active), None)
    previous_signature = None
    if previous_active:
        previous_signature = (
            str(previous_active.provider_config_id or ""),
            str(previous_active.model_name or ""),
            int(previous_active.embedding_dimensions or 0),
        )
    next_signature = (
        str(provider.id or ""),
        model_name,
        int(embedding_dimensions or 0),
    )
    if target is None:
        target = AiProviderBinding(
            id=str(uuid.uuid4()),
            purpose=purpose,
            provider_config_id=provider.id,
            created_at=now,
            created_by=updated_by_id,
        )
        db.add(target)

    for item in active_items:
        if item.id == target.id:
            continue
        item.is_active = False
        item.updated_at = now
        item.updated_by = updated_by_id

    target.model_name = model_name
    target.embedding_dimensions = embedding_dimensions
    target.is_active = True
    target.updated_at = now
    target.updated_by = updated_by_id

    if purpose == PURPOSE_CONTEXT_EMBEDDINGS and previous_signature and previous_signature != next_signature:
        (
            db.query(AiContextDocument)
            .filter(AiContextDocument.status == "synced")
            .filter(AiContextDocument.deactivated_at.is_(None))
            .update(
                {
                    "status": "outdated",
                    "last_error": "Documento desactualizado por cambio de provider/modelo de embeddings.",
                    "last_checked_at": now,
                },
                synchronize_session=False,
            )
        )

    db.commit()
    refreshed = _base_query(db).filter(AiProviderBinding.id == target.id).first()
    return _build_response_dict(refreshed)


def get_ai_provider_runtime_config_for_purpose(db: Session, purpose: str) -> dict[str, Any]:
    purpose = _normalize_purpose(purpose)
    binding = (
        _base_query(db)
        .filter(AiProviderBinding.purpose == purpose, AiProviderBinding.is_active.is_(True))
        .order_by(AiProviderBinding.updated_at.desc(), AiProviderBinding.created_at.desc())
        .first()
    )

    if not binding:
        raise BadRequestException(
            f"No existe una asignación AI activa para {PURPOSE_LABELS.get(purpose, purpose)}."
        )

    provider = binding.provider_config
    if not provider or provider.deleted_at is not None:
        raise BadRequestException("La asignación AI activa referencia un provider inexistente.")
    if str(provider.validation_status or "").strip() != "valid":
        raise BadRequestException("El provider asignado no está validado.")
    if not str(binding.model_name or "").strip():
        raise BadRequestException("La asignación AI activa no tiene modelo configurado.")
    if not bool(provider.is_active):
        raise BadRequestException("El provider asignado no está activo.")

    runtime = _build_runtime_response_dict(provider)
    runtime["model_name"] = binding.model_name
    runtime["purpose"] = purpose
    runtime["binding_id"] = binding.id
    runtime["embedding_dimensions"] = binding.embedding_dimensions
    return runtime


def require_ai_provider_runtime_config_for_purpose(
    db: Session,
    purpose: str,
    *,
    message: str | None = None,
) -> dict[str, Any]:
    try:
        return get_ai_provider_runtime_config_for_purpose(db, purpose)
    except BadRequestException as exc:
        raise ConflictException(message or exc.message) from exc

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from core.config import settings

_DEFAULT_PROVIDER_CATALOG: list[dict[str, Any]] = [
    {
        "id": "openai",
        "label": "OpenAI / ChatGPT",
        "base_url": "https://api.openai.com/v1",
        "validation_endpoint": "/models",
        "models_endpoint": "/models",
        "auth_type": "api_key",
        "provider_family": "openai_compatible",
        "models_response_format": "openai",
        "is_commercial": True,
    },
    {
        "id": "anthropic",
        "label": "Anthropic / Claude",
        "base_url": "https://api.anthropic.com/v1",
        "validation_endpoint": "/models",
        "models_endpoint": "/models",
        "auth_type": "api_key",
        "provider_family": "anthropic",
        "models_response_format": "anthropic",
        "is_commercial": True,
    },
    {
        "id": "deepseek",
        "label": "DeepSeek",
        "base_url": "https://api.deepseek.com",
        "validation_endpoint": "/models",
        "models_endpoint": "/models",
        "auth_type": "api_key",
        "provider_family": "openai_compatible",
        "models_response_format": "openai",
        "is_commercial": True,
    },
    {
        "id": "perplexity",
        "label": "Perplexity",
        "base_url": "https://api.perplexity.ai/v1",
        "validation_endpoint": "/models",
        "models_endpoint": "/models",
        "auth_type": "api_key",
        "provider_family": "openai_compatible",
        "models_response_format": "openai",
        "is_commercial": True,
    },
    {
        "id": "ollama_local",
        "label": "Ollama local",
        "base_url": "http://localhost:11434",
        "validation_endpoint": "/api/tags",
        "models_endpoint": "/api/tags",
        "auth_type": "none",
        "provider_family": "ollama",
        "models_response_format": "ollama",
        "is_commercial": False,
    },
    {
        "id": "ollama_remote",
        "label": "Ollama remoto",
        "base_url": "http://host.docker.internal:11434",
        "validation_endpoint": "/api/tags",
        "models_endpoint": "/api/tags",
        "auth_type": "none",
        "provider_family": "ollama",
        "models_response_format": "ollama",
        "is_commercial": False,
    },
    {
        "id": "custom",
        "label": "Custom",
        "base_url": "",
        "validation_endpoint": "",
        "models_endpoint": "",
        "auth_type": "none",
        "provider_family": "generic",
        "models_response_format": "generic",
        "is_commercial": False,
    },
]


def _normalize_entry(raw: dict[str, Any]) -> dict[str, Any] | None:
    provider_id = str(raw.get("id") or "").strip()
    if not provider_id:
        return None
    label = str(raw.get("label") or provider_id).strip() or provider_id
    provider_family = str(raw.get("provider_family") or provider_id).strip() or provider_id
    models_response_format = str(raw.get("models_response_format") or provider_family).strip() or provider_family
    auth_type = str(raw.get("auth_type") or "none").strip() or "none"

    return {
        "id": provider_id,
        "label": label,
        "base_url": str(raw.get("base_url") or "").strip(),
        "validation_endpoint": str(raw.get("validation_endpoint") or "").strip(),
        "models_endpoint": str(raw.get("models_endpoint") or "").strip(),
        "auth_type": auth_type,
        "provider_family": provider_family,
        "models_response_format": models_response_format,
        "is_commercial": bool(raw.get("is_commercial")),
    }


def _load_catalog_from_disk() -> list[dict[str, Any]] | None:
    catalog_path = Path(settings.ai_provider_catalog_path)
    if not catalog_path.exists():
        return None
    try:
        raw_data = json.loads(catalog_path.read_text(encoding="utf-8"))
    except Exception:
        return None

    if not isinstance(raw_data, list):
        return None

    normalized_items: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for raw_item in raw_data:
        if not isinstance(raw_item, dict):
            continue
        normalized = _normalize_entry(raw_item)
        if not normalized:
            continue
        if normalized["id"] in seen_ids:
            continue
        seen_ids.add(normalized["id"])
        normalized_items.append(normalized)

    return normalized_items or None


@lru_cache(maxsize=1)
def get_ai_provider_catalog() -> list[dict[str, Any]]:
    loaded = _load_catalog_from_disk()
    if loaded:
        return loaded
    return [dict(item) for item in _DEFAULT_PROVIDER_CATALOG]


def clear_ai_provider_catalog_cache() -> None:
    get_ai_provider_catalog.cache_clear()


def get_ai_provider_catalog_map() -> dict[str, dict[str, Any]]:
    return {item["id"]: item for item in get_ai_provider_catalog()}


def get_ai_provider_ids() -> set[str]:
    return {item["id"] for item in get_ai_provider_catalog()}


def get_ai_commercial_provider_ids() -> set[str]:
    return {item["id"] for item in get_ai_provider_catalog() if bool(item.get("is_commercial"))}


def get_ai_provider_definition(provider_id: str | None) -> dict[str, Any] | None:
    if not provider_id:
        return None
    return get_ai_provider_catalog_map().get(str(provider_id).strip())

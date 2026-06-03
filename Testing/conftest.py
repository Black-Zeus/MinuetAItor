from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from typing import Any

import pytest
import requests


@dataclass(frozen=True)
class QaSettings:
    base_url: str
    timeout_seconds: float
    admin_credential: str
    admin_password: str
    editor_credential: str
    editor_password: str
    viewer_credential: str
    viewer_password: str


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


@pytest.fixture(scope="session")
def qa_settings() -> QaSettings:
    return QaSettings(
        base_url=_env("QA_BASE_URL", "http://nginx/api").rstrip("/"),
        timeout_seconds=float(_env("QA_TIMEOUT_SECONDS", "15")),
        admin_credential=_env("QA_ADMIN_CREDENTIAL"),
        admin_password=_env("QA_ADMIN_PASSWORD"),
        editor_credential=_env("QA_EDITOR_CREDENTIAL"),
        editor_password=_env("QA_EDITOR_PASSWORD"),
        viewer_credential=_env("QA_VIEWER_CREDENTIAL"),
        viewer_password=_env("QA_VIEWER_PASSWORD"),
    )


@pytest.fixture(scope="session")
def api(qa_settings: QaSettings) -> requests.Session:
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})
    session.request_timeout = qa_settings.timeout_seconds
    return session


def api_url(settings: QaSettings, path: str) -> str:
    clean_path = path if path.startswith("/") else f"/{path}"
    return f"{settings.base_url}{clean_path}"


def request_json(
    api: requests.Session,
    settings: QaSettings,
    method: str,
    path: str,
    **kwargs: Any,
) -> requests.Response:
    kwargs.setdefault("timeout", settings.timeout_seconds)
    return api.request(method, api_url(settings, path), **kwargs)


def response_payload(response: requests.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError as exc:
        raise AssertionError(f"La respuesta no es JSON valido: {response.text[:300]}") from exc
    assert isinstance(payload, dict), "La respuesta JSON debe ser un objeto"
    return payload


def unwrap_result(response: requests.Response) -> Any:
    payload = response_payload(response)
    return payload.get("result", payload)


def assert_success_contract(response: requests.Response, expected_status: int = 200) -> dict[str, Any]:
    assert response.status_code == expected_status
    payload = response_payload(response)
    for key in ("success", "status", "result", "meta"):
        assert key in payload, f"Falta clave de contrato: {key}"
    assert payload["success"] is True
    assert payload["status"] == expected_status
    assert isinstance(payload["meta"], dict)
    assert "request_id" in payload["meta"]
    assert "timestamp" in payload["meta"]
    assert "route" in payload["meta"]
    return payload


def assert_http_status(response: requests.Response, allowed_statuses: set[int]) -> dict[str, Any]:
    assert response.status_code in allowed_statuses, response.text[:500]
    return response_payload(response)


@pytest.fixture(scope="session")
def admin_token(api: requests.Session, qa_settings: QaSettings) -> str:
    if not qa_settings.admin_credential or not qa_settings.admin_password:
        pytest.skip("Definir QA_ADMIN_CREDENTIAL y QA_ADMIN_PASSWORD para pruebas autenticadas")

    response = request_json(
        api,
        qa_settings,
        "POST",
        "/v1/auth/login",
        json={
            "credential": qa_settings.admin_credential,
            "password": qa_settings.admin_password,
        },
    )
    payload = assert_success_contract(response)
    token = payload["result"].get("access_token")
    assert token, "Login admin no retorno access_token"
    return token


@pytest.fixture(scope="session")
def admin_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}


def random_credential(prefix: str = "qa-missing") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}@example.invalid"

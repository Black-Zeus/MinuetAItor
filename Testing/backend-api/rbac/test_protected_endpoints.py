from __future__ import annotations

import pytest

from Testing.conftest import assert_http_status, assert_success_contract, request_json


PROTECTED_ENDPOINTS = [
    ("GET", "/v1/auth/me", None),
    ("POST", "/v1/clients/list", {"skip": 0, "limit": 1}),
    ("GET", "/v1/minutes/cycle-times", None),
    ("GET", "/v1/system/maintenance/settings", None),
]


@pytest.mark.rbac
@pytest.mark.parametrize("method,path,json_body", PROTECTED_ENDPOINTS)
def test_protected_endpoints_reject_missing_token(api, qa_settings, method, path, json_body):
    kwargs = {}
    if json_body is not None:
        kwargs["json"] = json_body

    response = request_json(api, qa_settings, method, path, **kwargs)

    assert_http_status(response, {401, 403})


@pytest.mark.rbac
@pytest.mark.requires_admin
def test_admin_can_read_clients_list(api, qa_settings, admin_headers):
    response = request_json(
        api,
        qa_settings,
        "POST",
        "/v1/clients/list",
        headers=admin_headers,
        json={"skip": 0, "limit": 5},
    )

    payload = assert_success_contract(response)
    result = payload["result"]
    assert set(("items", "total", "skip", "limit")).issubset(result.keys())
    assert isinstance(result["items"], list)

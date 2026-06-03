from __future__ import annotations

import pytest

from Testing.conftest import (
    assert_http_status,
    assert_success_contract,
    random_credential,
    request_json,
)


@pytest.mark.smoke
@pytest.mark.rbac
def test_login_rejects_invalid_credentials(api, qa_settings):
    response = request_json(
        api,
        qa_settings,
        "POST",
        "/v1/auth/login",
        json={
            "credential": random_credential(),
            "password": "invalid-password",
        },
    )

    assert_http_status(response, {401})


@pytest.mark.smoke
@pytest.mark.rbac
def test_me_requires_authentication(api, qa_settings):
    response = request_json(api, qa_settings, "GET", "/v1/auth/me")

    assert_http_status(response, {401, 403})


@pytest.mark.smoke
@pytest.mark.rbac
@pytest.mark.requires_admin
def test_admin_login_and_me(api, qa_settings, admin_headers):
    response = request_json(api, qa_settings, "GET", "/v1/auth/me", headers=admin_headers)

    payload = assert_success_contract(response)
    result = payload["result"]
    assert result["user_id"]
    assert result["username"]
    assert isinstance(result["roles"], list)
    assert isinstance(result["permissions"], list)

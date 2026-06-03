from __future__ import annotations

import pytest

from Testing.conftest import assert_success_contract, request_json


@pytest.mark.contract
def test_success_response_contract_contains_meta_route(api, qa_settings):
    response = request_json(api, qa_settings, "GET", "/health")

    payload = assert_success_contract(response)
    route = payload["meta"]["route"]
    assert route["method"] == "GET"
    assert route["path"].endswith("/health")


@pytest.mark.contract
@pytest.mark.requires_admin
def test_auth_me_contract_shape(api, qa_settings, admin_headers):
    response = request_json(api, qa_settings, "GET", "/v1/auth/me", headers=admin_headers)

    payload = assert_success_contract(response)
    result = payload["result"]
    expected_keys = {"user_id", "username", "roles", "permissions", "is_active"}
    assert expected_keys.issubset(result.keys())

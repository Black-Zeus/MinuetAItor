from __future__ import annotations

import pytest

from Testing.conftest import assert_success_contract, request_json


@pytest.mark.smoke
@pytest.mark.contract
def test_health_endpoint_responds_with_standard_contract(api, qa_settings):
    response = request_json(api, qa_settings, "GET", "/health")

    payload = assert_success_contract(response)
    result = payload["result"]
    assert result["status"] == "running"
    assert "env" in result


@pytest.mark.smoke
@pytest.mark.contract
def test_root_endpoint_responds_with_standard_contract(api, qa_settings):
    response = request_json(api, qa_settings, "GET", "/")

    payload = assert_success_contract(response)
    assert "response" in payload["result"]

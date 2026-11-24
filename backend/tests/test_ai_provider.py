import json
import pytest
import httpx
from unittest.mock import patch
from app.ai.ai_provider import OpenAICompatibleProvider, _generate_dynamic_analysis
from app.core.http_client import get_http_client

# Helper to create a mock async client
class MockAsyncClient:
    def __init__(self, transport):
        self._client = httpx.AsyncClient(transport=transport)
    async def post(self, *args, **kwargs):
        return await self._client.post(*args, **kwargs)
    async def aclose(self):
        await self._client.aclose()

@pytest.mark.asyncio
async def test_analyze_report_success(monkeypatch):
    # Prepare a mock response payload matching expected LLM output
    payload = {
        "choices": [{"message": {"content": json.dumps({"scores": {"overall_quality": 90}})}}]
    }
    async def mock_send(request):
        return httpx.Response(200, json=payload)
    transport = httpx.MockTransport(mock_send)
    mock_client = MockAsyncClient(transport)
    # Patch get_http_client to return our mock client
    monkeypatch.setattr('app.core.http_client.get_http_client', lambda: mock_client)
    provider = OpenAICompatibleProvider(api_base="https://example.com", model="test-model", default_api_key="test-key")
    result = await provider.analyze_report("some text")
    assert result["scores"]["overall_quality"] == 90

@pytest.mark.asyncio
async def test_analyze_report_fallback(monkeypatch):
    # Mock client to raise a request error
    async def mock_send(request):
        raise httpx.RequestError("network error", request=request)
    transport = httpx.MockTransport(mock_send)
    mock_client = MockAsyncClient(transport)
    monkeypatch.setattr('app.core.http_client.get_http_client', lambda: mock_client)
    provider = OpenAICompatibleProvider(api_base="https://example.com", model="test-model", default_api_key="test-key")
    # The fallback should be called, which returns a dynamic analysis dict
    result = await provider.analyze_report("some text")
    # Ensure the fallback result contains expected keys (e.g., "scores")
    assert isinstance(result, dict)
    assert "scores" in result

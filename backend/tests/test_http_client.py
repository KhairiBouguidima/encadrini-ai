import pytest
from app.core.http_client import get_http_client, close_http_client

@pytest.mark.asyncio
async def test_http_client_singleton():
    client1 = get_http_client()
    client2 = get_http_client()
    assert client1 is client2
    # close client and ensure new instance is created afterwards
    await close_http_client()
    client3 = get_http_client()
    assert client3 is not client1
    # cleanup
    await close_http_client()

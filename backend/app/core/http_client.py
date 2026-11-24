import logging
from typing import Optional

import httpx

logger = logging.getLogger("uvicorn.error")

# Global singleton client
_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    """Return a shared ``httpx.AsyncClient`` instance.

    The client is created lazily on first call and reused for the lifetime of the
    application.  Connection limits and timeouts are configured to be suitable for
    typical backend usage.
    """
    global _client
    if _client is None:
        # Configure limits – adjust if needed for your workload.
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=100)
        timeout = httpx.Timeout(30.0)  # seconds, for connect/read/write
        _client = httpx.AsyncClient(limits=limits, timeout=timeout)
        logger.info("✅ Async HTTP client created (httpx.AsyncClient)")
    return _client


async def close_http_client() -> None:
    """Close the shared client – called on FastAPI shutdown."""
    global _client
    if _client is not None:
        await _client.aclose()
        logger.info("✅ Async HTTP client closed")
        _client = None

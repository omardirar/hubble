"""Minimal MCP helper utilities."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

try:
    from mcp import ClientSession  # type: ignore
    from mcp.client.streamable_http import streamablehttp_client  # type: ignore
except ImportError as exc:  # pragma: no cover - surfaced during agent startup
    raise RuntimeError(
        "The 'mcp' package is required to call MCP tools. Install it with `pip install mcp`."
    ) from exc


def _build_headers(
    token: str | None, database: str | None, extra: dict[str, str] | None
) -> dict[str, str]:
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers.setdefault("x-motherduck-service-secret", token)
    if database:
        connection_uri = database if database.startswith("md:") else f"md:{database}"
        headers.setdefault("x-motherduck-connection", connection_uri)
        headers.setdefault("x-db-name", connection_uri.removeprefix("md:"))
    if extra:
        headers.update(extra)
    return headers


def _normalize_url(url: str) -> str:
    url = url.rstrip("/")
    return f"{url}/mcp" if not url.endswith("/mcp") else url


@asynccontextmanager
async def open_mcp_session(
    *,
    url: str,
    token: str | None = None,
    database: str | None = None,
    timeout: float = 30,
    sse_read_timeout: float = 300,
    extra_headers: dict[str, str] | None = None,
) -> AsyncIterator[ClientSession]:
    """Yield an initialised MCP ClientSession."""

    headers = _build_headers(token, database, extra_headers)
    target_url = _normalize_url(url)

    async with (
        streamablehttp_client(
            target_url,
            headers=headers or None,
            timeout=timeout,
            sse_read_timeout=sse_read_timeout,
        ) as (read_stream, write_stream, _),
        ClientSession(read_stream, write_stream) as session,
    ):
        await session.initialize()
        yield session


async def call_mcp_tool(
    *,
    url: str,
    tool_name: str,
    arguments: dict[str, Any],
    token: str | None = None,
    database: str | None = None,
    timeout: float = 30,
) -> Any:
    """Execute an MCP tool call and return the result object."""

    async with open_mcp_session(
        url=url,
        token=token,
        database=database,
        timeout=timeout,
    ) as session:
        return await session.call_tool(tool_name, arguments)

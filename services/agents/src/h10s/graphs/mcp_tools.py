"""MCP tool integration for marketing copilot agents."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient  # type: ignore[import-untyped]

from h10s.config import AppSettings

logger = logging.getLogger(__name__)


async def create_motherduck_tools(
    settings: AppSettings,
    *,
    headers_override: Mapping[str, str] | None = None,
) -> list[BaseTool]:
    """Create MCP tools for MotherDuck database queries.

    Connects to the MotherDuck MCP server and retrieves available tools
    with authentication headers for querying marketing data.

    Args:
        settings: Application settings with MCP configuration

    Returns:
        List of LangChain-compatible tools from MCP server
    """
    # Build authentication headers for MotherDuck
    headers: dict[str, str] = {
        key: value for key, value in (headers_override or {}).items() if value
    }

    if not headers:
        if settings.motherduck_token:
            headers["x-motherduck-service-secret"] = settings.motherduck_token.get_secret_value()
        if settings.motherduck_connection:
            headers["x-motherduck-connection"] = settings.motherduck_connection

    # Configure MCP client with HTTP transport
    mcp_config: dict[str, Any] = {
        "motherduck": {
            "url": settings.mcp_motherduck_url,
            "transport": "streamable_http",
            "headers": headers,
        }
    }

    logger.info("Initializing MotherDuck MCP client url=%s", settings.mcp_motherduck_url)

    try:
        client = MultiServerMCPClient(mcp_config)
        tools: list[BaseTool] = await client.get_tools()  # type: ignore[assignment]
        logger.info("Loaded %d tool(s) from MotherDuck MCP server", len(tools))
        return tools
    except Exception as e:
        logger.error("Failed to connect to MotherDuck MCP server: %s", e, exc_info=True)
        # Return empty list to allow graph to continue without tools
        return []


__all__ = ["create_motherduck_tools"]

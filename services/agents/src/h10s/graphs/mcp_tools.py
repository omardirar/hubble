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
    logger.debug("Creating MotherDuck MCP tools has_override=%s", headers_override is not None)

    # Build authentication headers for MotherDuck
    headers: dict[str, str] = {
        key: value for key, value in (headers_override or {}).items() if value
    }
    logger.debug("Using %d headers from override", len(headers))

    if not headers:
        logger.debug("No override headers, using settings configuration")
        if settings.motherduck_token:
            headers["x-motherduck-service-secret"] = settings.motherduck_token.get_secret_value()
            logger.debug("Added service secret from settings")
        if settings.motherduck_connection:
            headers["x-motherduck-connection"] = settings.motherduck_connection
            logger.debug(
                "Added connection string from settings: %s", settings.motherduck_connection
            )

    # Configure MCP client with HTTP transport
    mcp_config: dict[str, Any] = {
        "motherduck": {
            "url": settings.mcp_motherduck_url,
            "transport": "streamable_http",
            "headers": headers,
        }
    }

    logger.info(
        "Initializing MotherDuck MCP client url=%s header_count=%d",
        settings.mcp_motherduck_url,
        len(headers),
    )

    try:
        logger.debug("Creating MultiServerMCPClient")
        client = MultiServerMCPClient(mcp_config)

        logger.debug("Fetching tools from MCP server")
        tools: list[BaseTool] = await client.get_tools()  # type: ignore[assignment]

        logger.info("Successfully loaded %d tool(s) from MotherDuck MCP server", len(tools))

        if tools:
            tool_names = [getattr(t, "name", "<unknown>") for t in tools]
            logger.debug("Available tools: %s", ", ".join(tool_names))

        return tools
    except Exception as e:
        logger.error(
            "Failed to connect to MotherDuck MCP server url=%s error=%s",
            settings.mcp_motherduck_url,
            e,
            exc_info=True,
        )
        # Return empty list to allow graph to continue without tools
        logger.warning("Continuing without MotherDuck tools")
        return []


__all__ = ["create_motherduck_tools"]

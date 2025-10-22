"""Minimal MCP client abstraction used by tools."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class MCPClient:
    """Thin wrapper delegating to an injected transport."""

    def __init__(self, transport: Any | None = None) -> None:
        self._transport = transport
        logger.debug(
            "MCPClient initialised transport=%s", type(transport).__name__ if transport else None
        )

    def execute(self, query: str) -> Any:  # pragma: no cover - simple delegation
        if self._transport is None:
            logger.error("Attempted to execute MCP query without transport")
            raise RuntimeError("MCP client transport not configured")
        logger.debug("Executing MCP query length=%s", len(query))
        return self._transport.execute(query)


__all__ = ["MCPClient"]

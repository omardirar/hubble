"""Dice Roll MCP Server using FastMCP and streamable HTTP transport"""

import logging
from collections.abc import AsyncIterator
from typing import Any

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route

from .server import mcp

logger = logging.getLogger(__name__)


# Use FastMCP's session manager for lifespan
async def lifespan(app: Any) -> AsyncIterator[None]:
    async with mcp.session_manager.run():
        logger.info("Dice Roll MCP server started")
        yield
        logger.info("Dice Roll MCP server shutting down")


# Mount FastMCP's streamable HTTP app at root
async def health_endpoint(request: Any) -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "dice-roll"})


app = Starlette(
    routes=[
        Route("/health", health_endpoint, methods=["GET"]),
        Mount("/", app=mcp.streamable_http_app()),
    ],
    lifespan=lifespan,  # type: ignore[arg-type]
)

import contextlib
import logging
import os
from typing import Any

import click
import uvicorn
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route

from .asgi import HeaderCaptureApp
from .configs import (
    DEFAULT_LOG_LEVEL,
    SERVER_LOCALHOST,
    SERVER_VERSION,
    UVICORN_LOGGING_CONFIG,
    validate_http_env_or_raise,
)
from .server import get_motherduck_lifespan, get_motherduck_server

__version__ = SERVER_VERSION

logger = logging.getLogger("mcp_server_motherduck")


def _configure_root_logger() -> None:
    level_name = os.getenv("MOTHERDUCK_LOG_LEVEL") or os.getenv("LOG_LEVEL")
    if level_name:
        level = getattr(logging, level_name.upper(), logging.INFO)
    else:
        level = getattr(logging, DEFAULT_LOG_LEVEL, logging.INFO)

    logging.basicConfig(
        level=level,
        format="[motherduck] %(levelname)s - %(message)s",
    )
    logging.getLogger().setLevel(level)
    logging.getLogger("uvicorn").setLevel(level)
    logging.getLogger("uvicorn.error").setLevel(level)


_configure_root_logger()


@click.command()
@click.option("--port", default=8000, help="Port to listen on for HTTP transports")
@click.option(
    "--transport",
    type=click.Choice(["stdio", "sse", "stream"]),
    default="stream",
    help="(Default: `stream`) Transport type",
)
@click.option(
    "--default-connection",
    default=None,
    help=(
        "Optional MotherDuck connection URI (e.g. md:tenant_db) "
        "used when stdio transport is selected"
    ),
)
@click.option(
    "--motherduck-token",
    default=None,
    help=(
        "(Default: env var `motherduck_token`) "
        "Access token to use for MotherDuck database connections"
    ),
)
@click.option(
    "--saas-mode",
    is_flag=True,
    help="Flag for connecting to MotherDuck in SaaS mode",
)
@click.option(
    "--json-response",
    is_flag=True,
    default=False,
    help=(
        "(Default: `False`) Enable JSON responses instead of SSE streams. "
        "Only supported for `stream` transport."
    ),
)
def main(
    port: int,
    transport: str,
    default_connection: str | None,
    motherduck_token: str | None,
    saas_mode: bool,
    json_response: bool,
) -> None:
    """Main entry point for the package."""

    logger.info("🦆 MotherDuck MCP Server v" + SERVER_VERSION)
    logger.info("Ready to execute SQL queries against MotherDuck")

    # For now, force streamable HTTP transport as we've refactored to FastMCP
    if transport != "stream":
        logger.warning(
            f"Transport '{transport}' not supported in FastMCP version, using 'stream'"
        )
        transport = "stream"

    server = get_motherduck_server()

    logger.info("MCP server initialized in http-streamable mode")

    # Fail fast on missing envs in HTTP/SSE mode
    validate_http_env_or_raise(transport)

    # Create a lifespan that manages both the DB context and session manager
    @contextlib.asynccontextmanager
    async def combined_lifespan(app: Any) -> Any:
        # First, start the database context
        async with (
            get_motherduck_lifespan(
                db_path=default_connection,
                motherduck_token=motherduck_token,
                saas_mode=saas_mode,
            ) as _,
            server.session_manager.run(),
        ):
            logger.info("MotherDuck MCP server started")
            try:
                yield
            finally:
                logger.info("MotherDuck MCP server shutting down")

    # Mount FastMCP's streamable HTTP app at root
    stream_app = HeaderCaptureApp(server.streamable_http_app())

    async def health_endpoint(request: Any) -> JSONResponse:
        return JSONResponse({"status": "ok", "service": "motherduck"})

    starlette_app = Starlette(
        routes=[
            Route("/health", health_endpoint, methods=["GET"]),
            Mount("/", app=stream_app),
        ],
        lifespan=combined_lifespan,
    )

    logger.info(
        f"🦆 Connect to MotherDuck MCP Server at http://{SERVER_LOCALHOST}:{port}/mcp"
    )

    uvicorn.run(
        starlette_app,
        host=SERVER_LOCALHOST,
        port=port,
        log_config=UVICORN_LOGGING_CONFIG,
    )


# Optionally expose other important items at package level
__all__ = ["main"]

if __name__ == "__main__":
    main()

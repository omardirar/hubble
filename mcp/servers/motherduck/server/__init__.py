import logging
import os

import anyio
import click

from .configs import (
    DEFAULT_LOG_LEVEL,
    SERVER_LOCALHOST,
    SERVER_VERSION,
    UVICORN_LOGGING_CONFIG,
    validate_http_env_or_raise,
)
from .server import build_application

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
    help="Optional MotherDuck connection URI (e.g. md:tenant_db) used when stdio transport is selected",
)
@click.option(
    "--motherduck-token",
    default=None,
    help="(Default: env var `motherduck_token`) Access token to use for MotherDuck database connections",
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
    help="(Default: `False`) Enable JSON responses instead of SSE streams. Only supported for `stream` transport.",
)
def main(
    port,
    transport,
    default_connection,
    motherduck_token,
    saas_mode,
    json_response,
):
    """Main entry point for the package."""

    logger.info("🦆 MotherDuck MCP Server v" + SERVER_VERSION)
    logger.info("Ready to execute SQL queries against MotherDuck")

    app, init_opts = build_application(
        db_path=default_connection,
        motherduck_token=motherduck_token,
        saas_mode=saas_mode,
        transport=transport,
    )

    if transport == "sse":
        from mcp.server.sse import SseServerTransport
        from starlette.applications import Starlette
        from starlette.responses import Response
        from starlette.routing import Mount, Route

        from .asgi import HeaderCaptureApp

        logger.info("MCP server initialized in \033[32msse\033[0m mode")

        # Fail fast on missing envs in HTTP/SSE mode
        validate_http_env_or_raise(transport)

        sse = SseServerTransport("/messages/")

        async def handle_sse(request):
            async with sse.connect_sse(
                request.scope, request.receive, request._send
            ) as (read_stream, write_stream):
                await app.run(read_stream, write_stream, init_opts)
            return Response()

        logger.info(
            f"🦆 Connect to MotherDuck MCP Server at \033[1m\033[36mhttp://{SERVER_LOCALHOST}:{port}/sse\033[0m"
        )

        starlette_app = Starlette(
            debug=True,
            routes=[
                Route("/sse", endpoint=handle_sse, methods=["GET"]),
                Mount("/messages/", app=HeaderCaptureApp(sse.handle_post_message)),
            ],
        )

        import uvicorn

        uvicorn.run(
            starlette_app,
            host=SERVER_LOCALHOST,
            port=port,
            log_config=UVICORN_LOGGING_CONFIG,
        )

    elif transport == "stream":
        import contextlib
        from collections.abc import AsyncIterator

        from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
        from starlette.applications import Starlette
        from starlette.routing import Mount
        from starlette.types import Receive, Scope, Send

        from .asgi import HeaderCaptureApp

        logger.info("MCP server initialized in \033[32mhttp-streamable\033[0m mode")

        # Fail fast on missing envs in HTTP/SSE mode
        validate_http_env_or_raise(transport)

        # Create the session manager with true stateless mode
        session_manager = StreamableHTTPSessionManager(
            app=app,
            event_store=None,
            json_response=json_response,
            stateless=True,
        )

        async def handle_streamable_http(
            scope: Scope, receive: Receive, send: Send
        ) -> None:
            # Capture headers into context before handling request
            await HeaderCaptureApp(session_manager.handle_request)(scope, receive, send)

        @contextlib.asynccontextmanager
        async def lifespan(app: Starlette) -> AsyncIterator[None]:
            """Context manager for session manager."""
            async with session_manager.run():
                logger.info("MCP server started with StreamableHTTP session manager")
                try:
                    yield
                finally:
                    logger.info(
                        "🦆 MotherDuck MCP Server in \033[32mhttp-streamable\033[0m mode shutting down"
                    )

        logger.info(
            f"🦆 Connect to MotherDuck MCP Server at \033[1m\033[36mhttp://{SERVER_LOCALHOST}:{port}/\033[0m"
        )

        # Create an ASGI application using the transport
        starlette_app = Starlette(
            debug=True,
            routes=[
                Mount("/", app=handle_streamable_http),
            ],
            lifespan=lifespan,
        )

        import uvicorn

        uvicorn.run(
            starlette_app,
            host=SERVER_LOCALHOST,
            port=port,
            log_config=UVICORN_LOGGING_CONFIG,
        )

    else:
        from mcp.server.stdio import stdio_server

        logger.info("MCP server initialized in \033[32mstdio\033[0m mode")
        logger.info("Waiting for client connection")

        async def arun():
            async with stdio_server() as (read_stream, write_stream):
                await app.run(read_stream, write_stream, init_opts)

        anyio.run(arun)
        # This will only be reached when the server is shutting down
        logger.info(
            "🦆 MotherDuck MCP Server in \033[32mstdio\033[0m mode shutting down"
        )


# Optionally expose other important items at package level
__all__ = ["main"]

if __name__ == "__main__":
    main()

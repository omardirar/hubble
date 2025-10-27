from __future__ import annotations

import base64
import json
import logging
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Any

import anyio
from mcp import types
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.fastmcp.exceptions import ToolError
from mcp.server.session import ServerSession
from pydantic import AnyUrl

from .auth import AuthError, verify_and_extract
from .context import get_current_headers
from .database import DatabaseClient
from .prompt import PROMPT_TEMPLATE

logger = logging.getLogger("mcp_server_motherduck")

_current_motherduck_context: ContextVar[MotherDuckContext | None] = ContextVar(  # type: ignore[assignment]
    "_current_motherduck_context", default=None
)


@dataclass
class MotherDuckContext:
    """Application context with database client"""

    db_client: DatabaseClient


@dataclass(slots=True)
class RuntimeConfig:
    db_path: str | None = None
    motherduck_token: str | None = None
    saas_mode: bool = False


_RUNTIME_CONFIG = RuntimeConfig()


@asynccontextmanager
async def motherduck_lifespan(
    db_path: str | None,
    motherduck_token: str | None = None,
    saas_mode: bool = False,
) -> AsyncIterator[MotherDuckContext]:
    """Manage database client lifecycle"""
    db_client = DatabaseClient(
        db_path=db_path,
        motherduck_token=motherduck_token,
        saas_mode=saas_mode,
    )
    logger.info("MotherDuck database client initialized")
    context = MotherDuckContext(db_client=db_client)
    token: Token[MotherDuckContext | None] = _current_motherduck_context.set(context)
    try:
        yield context
    finally:
        _current_motherduck_context.reset(token)
        logger.info("MotherDuck database client shutting down")


@asynccontextmanager
async def _fastmcp_lifespan(_: FastMCP) -> AsyncIterator[MotherDuckContext]:
    async with motherduck_lifespan(
        db_path=_RUNTIME_CONFIG.db_path,
        motherduck_token=_RUNTIME_CONFIG.motherduck_token,
        saas_mode=_RUNTIME_CONFIG.saas_mode,
    ) as ctx:
        yield ctx


def configure_runtime_context(
    *,
    db_path: str | None,
    motherduck_token: str | None,
    saas_mode: bool,
) -> None:
    """Configure runtime defaults used when FastMCP spawns request lifespans."""
    _RUNTIME_CONFIG.db_path = db_path
    _RUNTIME_CONFIG.motherduck_token = motherduck_token
    _RUNTIME_CONFIG.saas_mode = saas_mode


# Create FastMCP server
mcp = FastMCP("motherduck", lifespan=_fastmcp_lifespan)


# Prompt
@mcp.prompt()
def duckdb_motherduck_initial_prompt() -> str:
    """Kickstart an analysis session against MotherDuck"""
    return PROMPT_TEMPLATE


# Tool
@mcp.tool()
async def query(
    query: str,
    format: str = "text",
    preview_rows: int = 20,
    ctx: Context[ServerSession, MotherDuckContext] | None = None,
) -> types.CallToolResult:
    """Execute a SQL query against the caller's MotherDuck database."""
    try:
        lifespan_context = None
        if ctx and hasattr(ctx.request_context, "lifespan_context"):
            lifespan_context = ctx.request_context.lifespan_context
        if lifespan_context is None:
            lifespan_context = _current_motherduck_context.get()
        if lifespan_context is None:
            raise ToolError("Database context unavailable.")

        db_client = getattr(lifespan_context, "db_client", None)
        if db_client is None:
            raise ToolError("Database client not available.")

        logger.info("Executing query")

        preview_rows = max(0, preview_rows)

        headers = get_current_headers()
        logger.info("Captured request headers: %s", headers)
        try:
            credentials = verify_and_extract(headers)
        except AuthError as auth_error:
            logger.warning("Unauthorized request: %s", auth_error)
            raise ToolError(f"Unauthorized: {auth_error}") from auth_error

        if format == "arrow":
            try:
                table, duration_ms = await anyio.to_thread.run_sync(
                    db_client.fetch_arrow_table,
                    query,
                    credentials,
                    cancellable=True,
                )
            except Exception as error:
                logger.error("Error fetching Arrow table: %s", error)
                raise ToolError("Error: Query failed") from error

            import pyarrow as pa  # type: ignore

            sink = pa.BufferOutputStream()
            with pa.ipc.new_file(sink, table.schema) as writer:
                writer.write_table(table)
            blob_bytes = sink.getvalue().to_pybytes()
            blob_b64 = base64.b64encode(blob_bytes).decode("ascii")

            resource_uri = f"urn:duckdb:result:{uuid.uuid4()}"

            metadata_lines = [
                f"Rows: {table.num_rows}",
                f"Duration: {duration_ms:.2f} ms",
                f"Resource URI: {resource_uri}",
            ]

            preview_text = ""
            if preview_rows > 0 and table.num_rows:
                display_rows = min(preview_rows, table.num_rows)
                preview_slice = table.slice(0, display_rows)
                preview_payload = preview_slice.to_pylist()
                preview_json = json.dumps(preview_payload, indent=2, default=str)
                preview_text = f"Preview (first {display_rows} rows):\n{preview_json}"

            # Build content list with proper union type for MCP
            contents: list[
                types.TextContent
                | types.ImageContent
                | types.AudioContent
                | types.ResourceLink
                | types.EmbeddedResource
            ] = [
                types.TextContent(
                    type="text",
                    text="\n".join(metadata_lines + ([preview_text] if preview_text else [])),
                )
            ]

            # Add embedded Arrow resource
            contents.append(
                types.EmbeddedResource(
                    type="resource",
                    resource=types.BlobResourceContents(
                        uri=AnyUrl(resource_uri),
                        blob=blob_b64,
                        mimeType="application/vnd.apache.arrow.file",
                    ),
                )
            )

            return types.CallToolResult(content=contents)

        try:
            tool_response = await anyio.to_thread.run_sync(
                db_client.query,
                query,
                credentials,
                cancellable=True,
            )
        except Exception as error:
            logger.error("Error executing query: %s", error)
            raise ToolError("Error: Query failed") from error

        return types.CallToolResult(
            content=[types.TextContent(type="text", text=str(tool_response))]
        )

    except ToolError:
        raise
    except Exception as exc:
        logger.error("Unexpected error executing tool: %s", exc)
        raise ToolError("Error: Tool execution encountered an unexpected failure") from exc


# Expose server and lifespan factory for external configuration
def get_motherduck_server() -> FastMCP:
    """Get the MotherDuck FastMCP server instance"""
    return mcp


def get_motherduck_lifespan(
    db_path: str | None,
    motherduck_token: str | None = None,
    saas_mode: bool = False,
) -> Any:
    """Get the lifespan context manager for MotherDuck

    Returns an async context manager that yields a MotherDuckContext.
    Using Any here because contextlib.AbstractAsyncContextManager requires
    complex type parameters that vary by Python version.
    """
    return motherduck_lifespan(
        db_path=db_path,
        motherduck_token=motherduck_token,
        saas_mode=saas_mode,
    )

"""High-level MCP client built on the official Python SDK."""

from __future__ import annotations

import time
from collections.abc import AsyncIterator, Callable
from contextlib import AsyncExitStack, asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

try:
    from mcp import ClientSession, types  # type: ignore
    from mcp.client.streamable_http import streamablehttp_client  # type: ignore

    MCP_SDK_AVAILABLE = True
except ImportError:  # pragma: no cover - handled at runtime
    MCP_SDK_AVAILABLE = False
    ClientSession = None  # type: ignore
    streamablehttp_client = None  # type: ignore
    types = None  # type: ignore

from ..utils.logging import get_logger
from .exceptions import (
    MCPConnectionError,
    MCPError,
    MCPInitializationError,
    MCPToolError,
)
from .session import get_session_tracker

logger = get_logger(__name__)


@dataclass(slots=True)
class MCPTool:
    """MCP tool metadata returned from discovery."""

    name: str
    description: str | None = None
    inputSchema: dict[str, Any] | None = None


class MCPClient:
    """Typed wrapper around the official MCP client session."""

    def __init__(
        self,
        url: str,
        token: str | None = None,
        database: str | None = None,
        *,
        timeout: float = 30,
        sse_read_timeout: float | None = None,
        extra_headers: dict[str, str] | None = None,
        **_: Any,
    ) -> None:
        if not MCP_SDK_AVAILABLE:
            raise MCPInitializationError(
                "MCP Python SDK not installed. Install with `pip install mcp`."
            )

        self._base_url = url.rstrip("/")
        self.url = self._ensure_mcp_path(self._base_url)
        self.token = token
        self.database = database
        self.timeout = timeout
        self.sse_read_timeout = sse_read_timeout or 300
        self._headers = self._build_headers(extra_headers)

        self._session: ClientSession | None = None
        self._exit_stack: AsyncExitStack | None = None
        self._session_id_getter: Callable[[], str | None] | None = None
        self._initialized = False
        self._connected = False
        self._server_name = self._derive_server_name(self.url)

        self._protocol_version: str | None = None
        self._server_info: types.Implementation | None = None  # type: ignore[attr-defined]
        self._server_capabilities: types.ServerCapabilities | None = None  # type: ignore[attr-defined]

        self._tools_cache: list[MCPTool] | None = None
        self._last_discovery: datetime | None = None

        self._session_tracker = get_session_tracker()
        self._mcp_session_id: str | None = None

    async def __aenter__(self) -> MCPClient:
        await self.initialize()
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        await self.close()

    @staticmethod
    def _ensure_mcp_path(url: str) -> str:
        if url.endswith("/mcp"):
            return url
        return f"{url}/mcp"

    def _build_headers(self, extra_headers: dict[str, str] | None) -> dict[str, str]:
        headers: dict[str, str] = {}

        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            headers.setdefault("x-motherduck-service-secret", self.token)

        if self.database:
            # Preserve md: prefix if present; otherwise default to md:<name>
            connection_uri = (
                self.database
                if self.database.startswith("md:")
                else f"md:{self.database}"
            )
            headers.setdefault("x-motherduck-connection", connection_uri)
            # Legacy header used by earlier deployments
            headers.setdefault("x-db-name", connection_uri.replace("md:", "", 1))

        if extra_headers:
            headers.update(extra_headers)

        return headers

    @staticmethod
    def _derive_server_name(url: str) -> str:
        parsed = urlparse(url)
        host = parsed.hostname or "unknown"
        port = f":{parsed.port}" if parsed.port else ""
        path = parsed.path or "/mcp"
        return f"{host}{port}{path}"

    async def initialize(self) -> bool:
        """Establish a streamable HTTP session and complete the MCP handshake."""
        if self._initialized:
            return True

        if streamablehttp_client is None or ClientSession is None:
            raise MCPInitializationError("MCP client SDK is unavailable.")

        logger.debug(f"Initializing MCP client for {self.url}")

        exit_stack = AsyncExitStack()
        try:
            logger.debug(f"Creating streamable HTTP client connection to {self.url}")
            (
                read_stream,
                write_stream,
                session_id_getter,
            ) = await exit_stack.enter_async_context(
                streamablehttp_client(
                    self.url,
                    headers=self._headers or None,
                    timeout=self.timeout,
                    sse_read_timeout=self.sse_read_timeout,
                )
            )
            logger.debug("Streamable HTTP client connection established")

            logger.debug("Creating MCP ClientSession")
            session = ClientSession(read_stream, write_stream)  # type: ignore[call-arg]
            logger.debug("Initializing MCP session handshake")
            init_result: types.InitializeResult = await session.initialize()  # type: ignore[name-defined]
            logger.debug("MCP session handshake completed successfully")

            protocol_version = str(init_result.protocolVersion)

            self._session = session
            self._exit_stack = exit_stack
            self._session_id_getter = session_id_getter
            self._protocol_version = protocol_version
            self._server_info = init_result.serverInfo
            self._server_capabilities = init_result.capabilities

            self._mcp_session_id = self._session_tracker.open_session(
                server_name=self._server_name,
                transport="http",
                protocol_version=protocol_version,
            )

            self._session_tracker.register_or_update_mcp_server(
                name=self._server_name,
                version=(
                    init_result.serverInfo.version if init_result.serverInfo else None
                ),
                transport="http",
                protocol_version=protocol_version,
            )

            self._initialized = True
            self._connected = True

            logger.info(
                "MCP client initialized for %s (protocol=%s)",
                self._server_name,
                protocol_version,
            )
            return True
        except (ConnectionError, OSError) as exc:
            # Clean up exit stack on connection failure
            try:
                await exit_stack.aclose()
            except Exception as cleanup_error:
                logger.debug(
                    f"Error during cleanup after connection failure: {cleanup_error}"
                )
            raise MCPConnectionError(
                f"Cannot connect to MCP server {self._server_name}: {exc}"
            ) from exc
        except Exception as exc:
            # Clean up exit stack on any other error
            try:
                await exit_stack.aclose()
            except Exception as cleanup_error:
                logger.debug(
                    "Error during cleanup after initialization failure: "
                    f"{cleanup_error}"
                )
            raise MCPInitializationError(
                f"Failed to initialize MCP client for {self._server_name}: {exc}"
            ) from exc

    def _ensure_session(self) -> ClientSession:
        if not self._initialized or not self._session:
            raise MCPConnectionError("MCP client is not initialized.")
        return self._session

    async def list_tools(self, force_refresh: bool = False) -> list[MCPTool]:
        """Fetch tools from the server, respecting a short-lived cache."""
        session = self._ensure_session()

        if (
            self._tools_cache
            and not force_refresh
            and self._last_discovery
            and (datetime.now(UTC) - self._last_discovery).total_seconds() < 300
        ):
            return self._tools_cache

        try:
            logger.debug(f"Calling list_tools() on MCP session for {self._server_name}")
            start_time = time.time()
            result = await session.list_tools()
            latency_ms = (time.time() - start_time) * 1000
            logger.debug("list_tools completed in %.2fms", latency_ms)

            tools = [
                MCPTool(
                    name=tool.name,
                    description=tool.description,
                    inputSchema=tool.inputSchema,
                )
                for tool in result.tools
            ]

            self._tools_cache = tools
            self._last_discovery = datetime.now(UTC)

            if tools:
                self._session_tracker.register_or_update_mcp_server(
                    name=self._server_name,
                    version=(self._server_info.version if self._server_info else None),
                    transport="http",
                    protocol_version=self._protocol_version,
                    tools=[
                        {"name": tool.name, "description": tool.description}
                        for tool in tools
                    ],
                )

            return tools
        except Exception as exc:
            logger.error("Error listing tools from %s: %s", self._server_name, exc)
            raise MCPToolError(f"Failed to list tools: {exc}") from exc

    async def call_tool(
        self, tool_name: str, arguments: dict[str, Any]
    ) -> types.CallToolResult:  # type: ignore[name-defined]
        """Invoke a tool and return the full MCP response."""
        session = self._ensure_session()

        try:
            start_time = time.time()
            result = await session.call_tool(tool_name, arguments)
            latency_ms = (time.time() - start_time) * 1000
            logger.debug("call_tool '%s' completed in %.2fms", tool_name, latency_ms)
            return result
        except Exception as exc:
            logger.error(
                "Error calling tool %s on %s: %s", tool_name, self._server_name, exc
            )
            raise MCPToolError(f"Failed to call tool {tool_name}: {exc}") from exc

    async def list_resources(self) -> list[types.Resource]:  # type: ignore[name-defined]
        """List resources exposed by the server."""
        session = self._ensure_session()

        try:
            result = await session.list_resources()
            return result.resources if result else []
        except Exception as exc:
            logger.error("Error listing resources from %s: %s", self._server_name, exc)
            raise MCPError(f"Failed to list resources: {exc}") from exc

    async def read_resource(self, uri: str) -> types.ReadResourceResult:  # type: ignore[name-defined]
        """Read the contents of a resource URI."""
        session = self._ensure_session()

        try:
            return await session.read_resource(uri)  # type: ignore[arg-type]
        except Exception as exc:
            logger.error(
                "Error reading resource %s from %s: %s", uri, self._server_name, exc
            )
            raise MCPError(f"Failed to read resource {uri}: {exc}") from exc

    async def health_check(self) -> bool:
        """Refresh tool metadata to confirm the server is reachable."""
        try:
            await self.list_tools(force_refresh=True)
            return True
        except Exception as exc:
            logger.warning("Health check failed for %s: %s", self._server_name, exc)
            return False

    async def close(self) -> None:
        """Terminate the MCP session and release resources."""
        if not self._initialized and not self._exit_stack:
            # Already closed or never initialized
            return

        try:
            if self._mcp_session_id:
                self._session_tracker.close_session(self._mcp_session_id)
        except Exception as e:
            logger.debug(f"Error closing session tracker: {e}")
        finally:
            self._mcp_session_id = None

        try:
            if self._session and hasattr(self._session, "aclose"):
                await self._session.aclose()  # type: ignore[attr-defined]
        except Exception as e:
            logger.debug(f"Error closing MCP session: {e}")
        finally:
            self._session = None

        # Close exit stack with comprehensive error handling
        if self._exit_stack:
            try:
                await self._exit_stack.aclose()
            except RuntimeError as e:
                # Handle anyio/asyncio context errors during cleanup
                error_msg = str(e).lower()
                if "cancel scope" in error_msg or "different task" in error_msg:
                    # This is expected during shutdown - suppress the error
                    logger.debug("Async context cleanup during shutdown (suppressed)")
                else:
                    logger.warning(f"RuntimeError during exit stack cleanup: {e}")
            except (ConnectionError, OSError) as e:
                # Network errors during cleanup are harmless
                logger.debug(f"Network error during cleanup (expected): {e}")
            except Exception as e:
                # Log but don't propagate other cleanup errors
                logger.debug(f"Error closing exit stack: {e}")
            finally:
                self._exit_stack = None

        self._session_id_getter = None
        self._initialized = False
        self._connected = False
        self._tools_cache = None
        self._last_discovery = None

        logger.info("MCP client closed for %s", self._server_name)

    @property
    def session_id(self) -> str | None:
        if not self._session_id_getter:
            return None
        return self._session_id_getter()


@asynccontextmanager
async def get_mcp_sdk_client(
    url: str,
    token: str | None = None,
    database: str | None = None,
    **kwargs: Any,
) -> AsyncIterator[MCPClient]:  # type: ignore[misc]
    """Async context manager helper that yields an initialized MCP client."""

    client = MCPClient(url=url, token=token, database=database, **kwargs)
    await client.initialize()
    try:
        yield client
    finally:
        await client.close()

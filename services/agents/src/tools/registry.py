"""Tool registry for managing agent tools and MCP servers"""

import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from ..utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class ToolDefinition:
    """Definition of a tool that agents can use"""

    name: str
    description: str
    function: Callable[..., Any]
    schema: dict[str, Any]
    source: str  # 'native' or 'mcp'
    mcp_server: str | None = None
    created_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.created_at is None:
            self.created_at = datetime.now()


class ToolRegistry:
    """Central registry for all agent tools"""

    def __init__(self) -> None:
        self.tools: dict[str, ToolDefinition] = {}
        self.mcp_clients: dict[str, Any] = {}  # Will store MCP client instances
        self.agent_tools: dict[str, list[str]] = {}  # Map agent names to tool names
        self._lock = threading.Lock()
        self._shutdown = False

    def register_tool(
        self, tool: ToolDefinition, agent_name: str | None = None
    ) -> None:
        """Register a new tool"""
        logger.debug(f"Registering tool: {tool.name} (source: {tool.source})")
        self.tools[tool.name] = tool

        # Associate with agent if specified
        if agent_name:
            if agent_name not in self.agent_tools:
                self.agent_tools[agent_name] = []
            self.agent_tools[agent_name].append(tool.name)

    def register_mcp_server(
        self, name: str, url: str, token: str | None = None, database: str | None = None
    ) -> None:
        """Register and connect to MCP server"""
        logger.debug(f"Connecting to MCP server: {name} at {url}")

        # Store MCP server configuration
        self.mcp_clients[name] = {
            "url": url,
            "token": token,
            "database": database,
            "connected": False,
        }

    async def register_mcp_server_async(
        self, name: str, url: str, token: str | None = None, database: str | None = None
    ) -> None:
        """Register and connect to MCP server with async tool discovery"""
        logger.debug(f"🔌 Registering MCP server: {name} at {url}")

        # Store MCP server configuration
        self.mcp_clients[name] = {
            "url": url,
            "token": token,
            "database": database,
            "connected": False,
            "error": None,
        }

        try:
            # Discover tools from MCP server and await completion
            await self._discover_mcp_tools(name)
            logger.debug(f"✅ Successfully registered MCP server: {name}")
        except (ConnectionError, OSError) as e:
            logger.warning(f"⚠️ Cannot connect to MCP server {name}: {e}")
            self.mcp_clients[name]["error"] = str(e)
            self.mcp_clients[name]["connected"] = False
            raise
        except Exception as e:
            logger.error(f"❌ Failed to register MCP server {name}: {e}")
            self.mcp_clients[name]["error"] = str(e)
            self.mcp_clients[name]["connected"] = False
            raise

    async def _discover_mcp_tools(self, server_name: str) -> None:
        """
        Discover and register tools from MCP server using proper async
        context managers
        """
        import asyncio

        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client

        try:
            server_config = self.mcp_clients[server_name]
            url = server_config["url"]

            # Build headers for authentication
            headers = {}
            if server_config.get("token"):
                headers["Authorization"] = f"Bearer {server_config['token']}"
                headers.setdefault(
                    "x-motherduck-service-secret", server_config["token"]
                )

            if server_config.get("database"):
                db_name = server_config["database"]
                connection_uri = (
                    db_name if db_name.startswith("md:") else f"md:{db_name}"
                )
                headers.setdefault("x-motherduck-connection", connection_uri)
                headers.setdefault("x-db-name", connection_uri.replace("md:", "", 1))

            timeout = server_config.get("timeout", 30)

            logger.debug(f"Connecting to {server_name} at {url}")

            # Use proper async context manager pattern (best practice from Context7)
            async with asyncio.timeout(
                60
            ):  # Overall timeout for connection + discovery
                async with streamablehttp_client(
                    url,
                    headers=headers or None,
                    timeout=timeout,
                    sse_read_timeout=300,
                ) as (read_stream, write_stream, _):
                    logger.debug(
                        f"Streamable HTTP connection established for {server_name}"
                    )

                    async with ClientSession(read_stream, write_stream) as session:
                        logger.debug(f"ClientSession created for {server_name}")

                        # Initialize the connection
                        await session.initialize()
                        logger.debug(f"Session initialized for {server_name}")

                        # List available tools
                        tools_result = await session.list_tools()
                        tools = tools_result.tools
                        logger.debug(
                            f"Discovered {len(tools)} tools from {server_name}"
                        )

                        # Register each tool
                        for tool in tools:
                            tool_def = ToolDefinition(
                                name=f"mcp_{server_name}_{tool.name}",
                                description=tool.description or "",
                                function=self._create_mcp_tool_wrapper_direct(
                                    server_name, tool.name, url, headers, timeout
                                ),
                                schema=tool.inputSchema or {},
                                source="mcp",
                                mcp_server=server_name,
                            )
                            self.register_tool(tool_def)

                        server_config["connected"] = True
                        logger.info(
                            f"✅ Successfully registered {len(tools)} tools "
                            f"from {server_name}"
                        )

        except TimeoutError:
            logger.warning(f"⏰ Timeout connecting to {server_name} (waited 60s)")
            self.mcp_clients[server_name]["connected"] = False
        except Exception as e:
            logger.error(f"❌ Failed to discover tools from {server_name}: {e}")
            self.mcp_clients[server_name]["connected"] = False

    def _create_mcp_tool_wrapper_direct(
        self,
        server_name: str,
        tool_name: str,
        url: str,
        headers: dict[str, str],
        timeout: int,
    ) -> Any:
        """Create a wrapper for MCP tool calls with fresh connection"""
        import asyncio

        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
        from mcp.types import TextContent

        async def mcp_tool_wrapper(**kwargs: Any) -> Any:
            try:
                # Create a fresh connection for each tool call (best practice)
                async with asyncio.timeout(timeout):
                    async with streamablehttp_client(
                        url,
                        headers=headers or None,
                        timeout=timeout,
                        sse_read_timeout=300,
                    ) as (read_stream, write_stream, _):
                        async with ClientSession(read_stream, write_stream) as session:
                            await session.initialize()
                            result = await session.call_tool(tool_name, kwargs)

                            # Extract text content from result
                            if result.content:
                                for content in result.content:
                                    if isinstance(content, TextContent):
                                        return content.text

                            # Return structured content if available
                            if (
                                hasattr(result, "structuredContent")
                                and result.structuredContent
                            ):
                                return result.structuredContent

                            return str(result)
            except Exception as e:
                logger.error(f"MCP tool {tool_name} on {server_name} failed: {e}")
                raise

        return mcp_tool_wrapper

    def get_tools_for_agent(self, agent_name: str) -> list[ToolDefinition]:
        """Get all tools available to an agent"""
        if agent_name in self.agent_tools:
            # Return agent-specific tools
            tool_names = self.agent_tools[agent_name]
            return [self.tools[name] for name in tool_names if name in self.tools]
        else:
            # Return all tools if no specific mapping
            return list(self.tools.values())

    def get_tool(self, name: str) -> ToolDefinition | None:
        """Get a specific tool by name"""
        return self.tools.get(name)

    def list_tools(self) -> list[ToolDefinition]:
        """List all registered tools"""
        return list(self.tools.values())

    def get_mcp_servers(self) -> dict[str, dict[str, Any]]:
        """Get all MCP server configurations"""
        return self.mcp_clients.copy()

    def is_mcp_connected(self, server_name: str) -> bool:
        """Check if MCP server is connected"""
        result = self.mcp_clients.get(server_name, {}).get("connected", False)
        return bool(result)

    def update_server_status(self, server_name: str, connected: bool) -> None:
        """Update the connection status of an MCP server"""
        if server_name in self.mcp_clients:
            self.mcp_clients[server_name]["connected"] = connected
            status = "connected" if connected else "disconnected"
            logger.debug(f"Updated {server_name} status: {status}")
        else:
            logger.warning(f"Server {server_name} not found in registry")

    def get_tool_stats(self) -> dict[str, Any]:
        """Get statistics about registered tools"""
        total_tools = len(self.tools)
        native_tools = len([t for t in self.tools.values() if t.source == "native"])
        mcp_tools = len([t for t in self.tools.values() if t.source == "mcp"])
        connected_servers = len(
            [s for s in self.mcp_clients.values() if s.get("connected", False)]
        )

        return {
            "total_tools": total_tools,
            "native_tools": native_tools,
            "mcp_tools": mcp_tools,
            "connected_mcp_servers": connected_servers,
            "total_mcp_servers": len(self.mcp_clients),
        }

    async def shutdown(self) -> None:
        """Shutdown registry and cleanup all resources"""
        with self._lock:
            if self._shutdown:
                return
            self._shutdown = True

        logger.debug("Shutting down tool registry...")

        # Close all MCP client connections with proper error handling
        for server_name, config in self.mcp_clients.items():
            try:
                if config.get("cleanup"):
                    await config["cleanup"]()
                    logger.debug(f"Closed MCP client for {server_name}")
            except RuntimeError as e:
                # Handle asyncio context errors during shutdown
                if "cancel scope" in str(e) or "different task" in str(e):
                    logger.debug(
                        f"Async context error closing {server_name} "
                        f"(expected during shutdown)"
                    )
                else:
                    logger.warning(
                        f"RuntimeError closing MCP client for {server_name}: {e}"
                    )
            except Exception as e:
                logger.warning(f"Error closing MCP client for {server_name}: {e}")

        # Clear all data
        self.tools.clear()
        self.mcp_clients.clear()
        self.agent_tools.clear()

        logger.debug("Tool registry shutdown complete")

    def is_shutdown(self) -> bool:
        """Check if registry is shutdown"""
        return self._shutdown


# Global registry instance with thread safety
_registry = None
_registry_lock = threading.Lock()


def get_registry() -> ToolRegistry:
    """Get the global tool registry (thread-safe)"""
    global _registry
    if _registry is None:
        with _registry_lock:
            if _registry is None:  # Double-check pattern
                _registry = ToolRegistry()
    return _registry


def register_native_tool(
    name: str,
    description: str,
    function: Callable[..., Any],
    schema: dict[str, Any],
    agent_name: str | None = None,
) -> ToolDefinition:
    """Convenience function to register a native tool"""
    tool = ToolDefinition(
        name=name,
        description=description,
        function=function,
        schema=schema,
        source="native",
    )
    registry = get_registry()
    registry.register_tool(tool, agent_name)
    return tool

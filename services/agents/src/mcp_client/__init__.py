"""
MCP Client Infrastructure

Model Context Protocol (MCP) client implementation with production-grade features.

Components:
- client.py: MCP client using official Python SDK with best practices
- pool.py: Connection pooling with resilience patterns
- protocol.py: MCP protocol message definitions (JSON-RPC 2.0)
- exceptions.py: MCP-specific exception hierarchy
- resilience.py: Circuit breaker, rate limiting, and metrics collection
- session.py: Session lifecycle management
- health.py: Health checking system
"""

from .client import MCPClient, MCPTool, get_mcp_sdk_client
from .exceptions import MCPConnectionError, MCPError, MCPToolError
from .pool import MCPConnectionPool, get_connection_pool, get_pooled_client

__all__ = [
    "MCPClient",
    "MCPConnectionError",
    "MCPConnectionPool",
    "MCPError",
    "MCPTool",
    "MCPToolError",
    "get_connection_pool",
    "get_mcp_sdk_client",
    "get_pooled_client",
]

# MCP Client Infrastructure

Model Context Protocol (MCP) client implementation with production-grade features.

## Components

- **client.py**: Main MCP client with pooled HTTP connections and resilience
- **protocol.py**: MCP protocol message definitions (JSON-RPC 2.0)
- **exceptions.py**: MCP-specific exception hierarchy
- **resilience.py**: Circuit breaker, rate limiting, and metrics collection
- **session.py**: Session lifecycle management via the DI container
- **health.py**: Health checking system leveraging the shared metrics collector

## Usage

```python
from src.mcp.client import MCPClient

async with MCPClient(url="http://localhost:8001") as client:
    tools = await client.list_tools()
    result = await client.call_tool("query", {"sql": "SELECT 1"})
```

## Architecture

MCP client follows a layered architecture:

1. Protocol Layer (`protocol.py`, `exceptions.py`)
2. Transport Layer (`client.py`, `session.py`)
3. Resilience & Observability Layer (`resilience.py`, `health.py`)

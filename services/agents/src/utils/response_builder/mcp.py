"""MCP-specific response building utilities"""

from ...models.response_schema import MCPInfo, MCPServer, MCPSession


def build_mcp_servers(sessions: list[MCPSession]) -> list[MCPServer]:
    """Build MCP servers list from sessions"""
    servers = {}
    for session in sessions:
        server_name = session.server
        if server_name not in servers:
            servers[server_name] = MCPServer(
                name=server_name,
                version="unknown",
                transport=session.transport,
                protocol_version=session.protocol_version,
                tools=[],  # Could be populated from actual tool calls
                tool_schema_version=None,
            )
    return list(servers.values())


def build_mcp_info(sessions: list[MCPSession], servers: list[MCPServer]) -> MCPInfo:
    """Build MCP information from sessions and servers"""
    return MCPInfo(servers=servers, sessions=sessions)

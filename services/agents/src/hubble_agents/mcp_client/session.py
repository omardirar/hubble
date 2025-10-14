"""MCP Session Management

Consolidated session tracking and lifecycle management for MCP connections.
"""

import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

from ..models.response_schema import MCPServer, MCPSession
from ..utils.container import get_container


class MCPSessionTracker:
    """Tracks MCP session lifecycles with protocol and sequence tracking"""

    def __init__(self) -> None:
        self.sessions: dict[str, MCPSession] = {}
        self.active_sessions: dict[str, str] = {}  # session_id -> server_name
        self.sequence_counters: dict[str, int] = {}  # session_id -> current_sequence
        self._servers: dict[str, MCPServer] = {}

    def open_session(
        self,
        server_name: str,
        transport: str,
        tool_schema_version: str | None = None,
        protocol_version: str | None = None,
    ) -> str:
        """Open a new MCP session and return session_id"""
        session_id = str(uuid.uuid4())
        opened_at = datetime.now(UTC)

        session = MCPSession(
            session_id=uuid.UUID(session_id),
            server=server_name,
            transport=transport,
            protocol_version=protocol_version,
            opened_at=opened_at,
            closed_at=opened_at,  # Will be updated on close
            sequence_id_start=0,
            sequence_id_end=None,
        )

        self.sessions[session_id] = session
        self.active_sessions[session_id] = server_name
        self.sequence_counters[session_id] = 0

        return session_id

    def close_session(
        self, session_id: str, sequence_id_end: int | None = None
    ) -> None:
        """Close an MCP session and record final sequence"""
        if session_id in self.sessions:
            session = self.sessions[session_id]

            # Ensure closed_at is at least 1ms after opened_at for realistic timing
            closed_at = datetime.now(UTC)
            # Ensure opened_at is timezone-aware for comparison
            opened_at = session.opened_at
            if opened_at.tzinfo is None:
                opened_at = opened_at.replace(tzinfo=UTC)
            if closed_at <= opened_at:
                closed_at = opened_at + timedelta(milliseconds=1)

            session.closed_at = closed_at
            session.sequence_id_end = sequence_id_end or self.sequence_counters.get(
                session_id, 0
            )

            # Remove from active sessions
            self.active_sessions.pop(session_id, None)
            self.sequence_counters.pop(session_id, None)

    def update_sequence(self, session_id: str, sequence_id: int) -> None:
        """Update sequence counter for delivery ordering"""
        if session_id in self.sequence_counters:
            self.sequence_counters[session_id] = max(
                self.sequence_counters[session_id], sequence_id
            )

    def get_active_sessions(self) -> list[MCPSession]:
        """Get list of currently active sessions"""
        return [
            session
            for session_id, session in self.sessions.items()
            if session_id in self.active_sessions
        ]

    def get_all_sessions(self) -> list[MCPSession]:
        """Get complete session history for the run"""
        return list(self.sessions.values())

    def get_servers(self) -> list[MCPServer]:
        """Get unique servers from session history"""
        if self._servers:
            return list(self._servers.values())

        servers = {}
        for session in self.sessions.values():
            server_name = session.server
            if server_name not in servers:
                servers[server_name] = MCPServer(
                    name=server_name,
                    version="unknown",
                    transport=session.transport,
                    protocol_version=session.protocol_version,
                    tools=[],
                    tool_schema_version=None,
                )
        return list(servers.values())

    def register_or_update_mcp_server(
        self,
        name: str,
        *,
        version: str | None = None,
        transport: str = "http",
        protocol_version: str | None = None,
        tool_schema_version: str | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> None:
        """Register or update MCP server metadata."""
        existing = self._servers.get(name)

        merged_tools = tools or []
        if existing and existing.tools:
            # Create a set of tool names for deduplication
            existing_tool_names = {tool.get("name", "") for tool in existing.tools}
            new_tools = [
                tool
                for tool in merged_tools
                if tool.get("name", "") not in existing_tool_names
            ]
            merged_tools = existing.tools + new_tools

        self._servers[name] = MCPServer(
            name=name,
            version=version or (existing.version if existing else "unknown"),
            transport=transport,
            protocol_version=protocol_version
            or (existing.protocol_version if existing else None),
            tools=merged_tools,
            tool_schema_version=tool_schema_version
            or (existing.tool_schema_version if existing else None),
        )

    def register_server(
        self,
        name: str,
        *,
        version: str | None = None,
        transport: str = "http",
        protocol_version: str | None = None,
        tool_schema_version: str | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> None:
        """Register or update MCP server metadata (alias for backward compatibility)."""
        self.register_or_update_mcp_server(
            name=name,
            version=version,
            transport=transport,
            protocol_version=protocol_version,
            tool_schema_version=tool_schema_version,
            tools=tools,
        )

    def update_session_details(
        self,
        session_id: str,
        *,
        protocol_version: str | None = None,
        tool_schema_version: str | None = None,
    ) -> None:
        """Update stored session information."""
        session = self.sessions.get(session_id)
        if not session:
            return

        if protocol_version:
            session.protocol_version = protocol_version
        if tool_schema_version and session.server in self._servers:
            server = self._servers[session.server]
            self._servers[session.server] = server.model_copy(
                update={"tool_schema_version": tool_schema_version}
            )

    def get_session(self, session_id: str) -> MCPSession | None:
        """Get specific session by ID"""
        return self.sessions.get(session_id)

    def is_active(self, session_id: str) -> bool:
        """Check if session is currently active"""
        return session_id in self.active_sessions

    @asynccontextmanager
    async def session_context(
        self,
        server_name: str,
        transport: str,
        tool_schema_version: str | None = None,
        protocol_version: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Context manager for automatic session open/close"""
        session_id = self.open_session(
            server_name=server_name,
            transport=transport,
            tool_schema_version=tool_schema_version,
            protocol_version=protocol_version,
        )

        try:
            yield session_id
        finally:
            self.close_session(session_id)

    def get_server_sessions(self, server_name: str) -> list[MCPSession]:
        """Get all sessions for a specific server"""
        return [
            session
            for session in self.sessions.values()
            if session.server == server_name
        ]

    def get_session_stats(self) -> dict[str, int]:
        """Get session statistics"""
        total_sessions = len(self.sessions)
        active_sessions = len(self.active_sessions)
        closed_sessions = total_sessions - active_sessions

        return {
            "total_sessions": total_sessions,
            "active_sessions": active_sessions,
            "closed_sessions": closed_sessions,
        }

    def clear(self) -> None:
        """Clear all session data (useful for testing)"""
        self.sessions.clear()
        self.active_sessions.clear()
        self.sequence_counters.clear()


# Register session tracker with container
def _create_session_tracker() -> MCPSessionTracker:
    """Factory function for creating session tracker"""
    return MCPSessionTracker()


def get_session_tracker() -> MCPSessionTracker:
    """Get session tracker from dependency injection container"""
    container = get_container()
    if not container.has(MCPSessionTracker):
        container.register_singleton(MCPSessionTracker, _create_session_tracker)
    tracker = container.get(MCPSessionTracker)
    assert isinstance(tracker, MCPSessionTracker)
    return tracker


def reset_session_tracker() -> None:
    """Reset the session tracker (useful for testing)"""
    container = get_container()
    if container.has(MCPSessionTracker):
        # Clear the singleton instance
        definition = container._services[MCPSessionTracker]
        definition.instance = None

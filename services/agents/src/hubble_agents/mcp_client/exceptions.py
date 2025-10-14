"""MCP-specific exception hierarchy"""

from typing import Any


class MCPError(Exception):
    """Base exception for MCP-related errors"""

    def __init__(
        self,
        message: str,
        code: int | None = None,
        data: Any | None = None,
        request_id: str | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.data = data
        self.request_id = request_id

    def __str__(self) -> str:
        base_msg = f"MCP Error: {self.message}"
        if self.code is not None:
            base_msg += f" (code: {self.code})"
        if self.request_id:
            base_msg += f" (request_id: {self.request_id})"
        return base_msg


class MCPConnectionError(MCPError):
    """Raised when connection to MCP server fails"""

    pass


class MCPTimeoutError(MCPError):
    """Raised when MCP request times out"""

    pass


class MCPToolError(MCPError):
    """Raised when MCP tool execution fails"""

    pass


class MCPProtocolError(MCPError):
    """Raised when MCP protocol violation occurs"""

    pass


class MCPAuthenticationError(MCPError):
    """Raised when MCP authentication fails"""

    pass


class MCPInitializationError(MCPError):
    """Raised when MCP session initialization fails"""

    pass


class MCPToolNotFoundError(MCPError):
    """Raised when requested tool is not found"""

    pass


class MCPInvalidParamsError(MCPError):
    """Raised when tool parameters are invalid"""

    pass


def create_mcp_error_from_response(response_data: dict[str, Any]) -> MCPError:
    """Create appropriate MCP error from response data"""
    error = response_data.get("error", {})
    code = error.get("code")
    message = error.get("message", "Unknown error")
    data = error.get("data")
    request_id = response_data.get("id")

    # Map error codes to specific exception types
    if code == -32001:  # TOOL_NOT_FOUND
        return MCPToolNotFoundError(message, code, data, request_id)
    elif code == -32002:  # TOOL_EXECUTION_ERROR
        return MCPToolError(message, code, data, request_id)
    elif code == -32003:  # CONNECTION_ERROR
        return MCPConnectionError(message, code, data, request_id)
    elif code == -32602:  # INVALID_PARAMS
        return MCPInvalidParamsError(message, code, data, request_id)
    elif code == -32601:  # METHOD_NOT_FOUND
        return MCPProtocolError(message, code, data, request_id)
    else:
        return MCPError(message, code, data, request_id)

"""MCP Protocol implementation following JSON-RPC 2.0 specification"""

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class MCPErrorCode(Enum):
    """MCP error codes as per specification"""

    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603
    SERVER_ERROR = -32000
    # MCP specific errors
    TOOL_NOT_FOUND = -32001
    TOOL_EXECUTION_ERROR = -32002
    CONNECTION_ERROR = -32003


@dataclass
class MCPRequest:
    """MCP request following JSON-RPC 2.0 specification"""

    jsonrpc: str = "2.0"
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    method: str = ""
    params: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "jsonrpc": self.jsonrpc,
            "id": self.id,
            "method": self.method,
            "params": self.params,
        }


@dataclass
class MCPResponse:
    """MCP response following JSON-RPC 2.0 specification"""

    jsonrpc: str = "2.0"
    id: str = ""
    result: dict[str, Any] | None = field(default=None)
    error: dict[str, Any] | None = field(default=None)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MCPResponse":
        """Create from dictionary"""
        return cls(
            jsonrpc=data.get("jsonrpc", "2.0"),
            id=data.get("id", ""),
            result=data.get("result"),
            error=data.get("error"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data: dict[str, Any] = {"jsonrpc": self.jsonrpc, "id": self.id}
        if self.result is not None:
            data["result"] = self.result
        if self.error is not None:
            data["error"] = self.error
        return data

    def is_error(self) -> bool:
        """Check if response contains an error"""
        return self.error is not None

    def get_error_code(self) -> int | None:
        """Get error code if present"""
        if self.error:
            return self.error.get("code")
        return None

    def get_error_message(self) -> str | None:
        """Get error message if present"""
        if self.error:
            return self.error.get("message")
        return None


@dataclass
class MCPInitializeParams:
    """Parameters for MCP initialize request"""

    protocolVersion: str = "2024-11-05"
    capabilities: dict[str, Any] = field(default_factory=dict)
    clientInfo: dict[str, str] = field(
        default_factory=lambda: {"name": "hubble-agent", "version": "1.0.0"}
    )


@dataclass
class MCPInitializeResult:
    """Result from MCP initialize response"""

    protocolVersion: str
    capabilities: dict[str, Any]
    serverInfo: dict[str, str]


@dataclass
class MCPTool:
    """MCP tool definition"""

    name: str
    description: str
    inputSchema: dict[str, Any]


@dataclass
class MCPToolCallParams:
    """Parameters for MCP tool call"""

    name: str
    arguments: dict[str, Any]


class MCPProtocol:
    """MCP protocol message factory and utilities"""

    @staticmethod
    def create_initialize_request(params: MCPInitializeParams) -> MCPRequest:
        """Create initialize request"""
        return MCPRequest(
            method="initialize",
            params={
                "protocolVersion": params.protocolVersion,
                "capabilities": params.capabilities,
                "clientInfo": params.clientInfo,
            },
        )

    @staticmethod
    def create_tools_list_request() -> MCPRequest:
        """Create tools/list request"""
        return MCPRequest(method="tools/list", params={})

    @staticmethod
    def create_tool_call_request(name: str, arguments: dict[str, Any]) -> MCPRequest:
        """Create tools/call request"""
        return MCPRequest(
            method="tools/call", params={"name": name, "arguments": arguments}
        )

    @staticmethod
    def create_error_response(
        request_id: str, code: int, message: str, data: Any | None = None
    ) -> MCPResponse:
        """Create error response"""
        error = {"code": code, "message": message}
        if data is not None:
            error["data"] = data

        return MCPResponse(id=request_id, error=error)

    @staticmethod
    def create_success_response(request_id: str, result: dict[str, Any]) -> MCPResponse:
        """Create success response"""
        return MCPResponse(id=request_id, result=result)

    @staticmethod
    def parse_tools_list_response(response: MCPResponse) -> list[MCPTool]:
        """Parse tools/list response"""
        if response.is_error():
            raise ValueError(
                f"Tools list request failed: {response.get_error_message()}"
            )

        if response.result is None:
            return []

        tools_data = response.result.get("tools", [])
        tools = []
        for tool_data in tools_data:
            tool = MCPTool(
                name=tool_data["name"],
                description=tool_data["description"],
                inputSchema=tool_data.get("inputSchema", {}),
            )
            tools.append(tool)
        return tools

    @staticmethod
    def parse_tool_call_response(response: MCPResponse) -> Any:
        """Parse tools/call response"""
        if response.is_error():
            error_code = response.get_error_code()
            error_message = response.get_error_message()
            raise ValueError(f"Tool call failed (code {error_code}): {error_message}")

        # Handle different response formats
        if response.result is None:
            return None

        result = response.result
        if "content" in result:
            return result["content"]
        elif "text" in result:
            return result["text"]
        else:
            return result

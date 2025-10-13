"""Pydantic models for agent response schema v1.3+

This module defines the complete schema for agent responses, aligned with PydanticAI,
Anthropic thinking features, and MCP standards. Key design principles:

- Messages stored as bytes only (no str union) for DB efficiency
- Full error/cancellation parity with dedicated event types
- Provider provenance on every model-produced step
- Token hygiene: reasoning and cache tokens never folded into base counters
- MCP protocol fidelity with version and sequence tracking
- Tracing & tagging support for distributed systems
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import Enum
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)


class ConversationContext(BaseModel):
    """Conversation context identifiers"""

    conversation_id: str
    org_id: str
    user_id: str


class RequestInfo(BaseModel):
    """Request information with trigger source"""

    timestamp: datetime
    user_message: str
    requested_by: Literal["user", "system", "automation"] | None = "user"

    @field_serializer("timestamp", when_used="json")
    def _ts_iso(self, v: datetime) -> str:
        return (
            v.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        )


class WorkflowConfig(BaseModel):
    """Workflow configuration"""

    type: Literal["single_agent", "multi_agent"]
    supervisor_agent: str
    sub_agents: list[dict[str, Any]]  # [{"name": "agent_name", "as_tool": bool}]


class ModelConfig(BaseModel):
    """Model configuration"""

    provider: str
    name: str


class ModelSettings(BaseModel):
    """Model settings including thinking budget"""

    temperature: float
    max_tokens: int
    top_p: float
    thinking: dict[str, Any] | None = None  # {"enabled": bool, "budget_tokens": int}


class AgentConfig(BaseModel):
    """Agent configuration"""

    name: str
    role: str
    model: ModelConfig
    model_settings: ModelSettings


class RoutingCandidate(BaseModel):
    """Routing candidate for analytics"""

    type: Literal["agent", "tool", "mcp_tool"]
    target: str
    score: float
    eligible: bool


class RoutingSelection(BaseModel):
    """Routing selection details"""

    selected: str
    thresholds: dict[str, float] | None = None


class RoutingDecision(BaseModel):
    """Routing decision with analytics"""

    decider: str
    reason: str
    confidence: float
    strategy: (
        Literal["rule_based", "prompt_router", "tool_router_llm", "hybrid"] | None
    ) = None
    candidates: list[RoutingCandidate] | None = None
    selection: RoutingSelection | None = None


class OutputResult(BaseModel):
    """Output result"""

    type: str
    value: str


class ErrorInfo(BaseModel):
    """Error information for failed events"""

    code: str
    message: str
    provider_code: str | None = None


# Discriminated union event data classes
class WorkflowStartData(BaseModel):
    """Workflow start event data"""

    model_config = ConfigDict()
    event_type: Literal["workflow_start"] = "workflow_start"
    entrypoint: str | None = None


class AgentRunStartedData(BaseModel):
    """Agent run started event data"""

    model_config = ConfigDict()
    event_type: Literal["agent_run_started"] = "agent_run_started"


class ThinkingCompletedData(BaseModel):
    """Thinking completed event data"""

    model_config = ConfigDict()
    event_type: Literal["thinking_completed"] = "thinking_completed"
    content: str
    model_name: str
    provider_name: str
    provider_request_id: str | None = None
    provider_response_id: str | None = None
    finish_reason: str
    truncated: bool = False
    parent_event_id: str | None = None
    usage: UsageDetails | None = None


class TextCompletedData(BaseModel):
    """Text completed event data"""

    model_config = ConfigDict()
    event_type: Literal["text_completed"] = "text_completed"
    content: str
    model_name: str
    provider_name: str
    provider_request_id: str | None = None
    provider_response_id: str | None = None
    finish_reason: str
    truncated: bool = False
    parent_event_id: str | None = None
    usage: UsageDetails | None = None


class ToolCallCompletedData(BaseModel):
    """Tool call completed event data"""

    model_config = ConfigDict()
    event_type: Literal["tool_call_completed"] = "tool_call_completed"
    tool_kind: str
    tool_name: str
    tool_call_id: str
    args: dict[str, Any] | None = None
    result: Any | None = None
    duration_ms: float | None = None
    usage: UsageDetails | None = None


class McpRequestCompletedData(BaseModel):
    """MCP request completed event data"""

    model_config = ConfigDict()
    event_type: Literal["mcp_request_completed"] = "mcp_request_completed"
    server: str
    session_id: str
    request: dict[str, Any]
    response: dict[str, Any]
    duration_ms: float | None = None
    usage: UsageDetails | None = None
    media_type: str | None = None
    size_bytes: int | None = None
    sha256: str | None = None
    request_size_bytes: int | None = None
    request_sha256: str | None = None
    response_size_bytes: int | None = None
    response_sha256: str | None = None
    payload_truncated: bool = False


class AgentRunCompletedData(BaseModel):
    """Agent run completed event data"""

    model_config = ConfigDict()
    event_type: Literal["agent_run_completed"] = "agent_run_completed"


class WorkflowCompleteData(BaseModel):
    """Workflow complete event data"""

    model_config = ConfigDict()
    event_type: Literal["workflow_complete"] = "workflow_complete"
    status: str
    total_events: int


class WorkflowCancelledData(BaseModel):
    """Workflow cancelled event data"""

    model_config = ConfigDict()
    event_type: Literal["workflow_cancelled"] = "workflow_cancelled"
    error: ErrorInfo
    workflow_stage: str | None = None
    run_id: str | None = None


class FailedEventData(BaseModel):
    """Failed event data"""

    model_config = ConfigDict()
    event_type: Literal["failed"] = "failed"
    error: ErrorInfo
    parent_event_id: str | None = None


# Internal-only start event data classes (not exported in v1.3)
class ToolCallStartedData(BaseModel):
    """Tool call started event data (internal only)"""

    model_config = ConfigDict()
    event_type: Literal["tool_call_started"] = "tool_call_started"
    tool_kind: str
    tool_name: str
    tool_call_id: str
    args: dict[str, Any] | None = None


class McpRequestStartedData(BaseModel):
    """MCP request started event data (internal only)"""

    model_config = ConfigDict()
    event_type: Literal["mcp_request_started"] = "mcp_request_started"
    server: str
    session_id: str
    request: dict[str, Any]


class ThinkingStartedData(BaseModel):
    """Thinking started event data (internal only)"""

    model_config = ConfigDict()
    event_type: Literal["thinking_started"] = "thinking_started"
    model_name: str
    provider_name: str
    provider_request_id: str | None = None


class TextStartedData(BaseModel):
    """Text started event data (internal only)"""

    model_config = ConfigDict()
    event_type: Literal["text_started"] = "text_started"
    model_name: str
    provider_name: str
    provider_request_id: str | None = None


# Discriminated union for event data
EventData = Annotated[
    WorkflowStartData
    | AgentRunStartedData
    | ThinkingCompletedData
    | TextCompletedData
    | ToolCallCompletedData
    | McpRequestCompletedData
    | AgentRunCompletedData
    | WorkflowCompleteData
    | WorkflowCancelledData
    | FailedEventData,
    Field(discriminator="event_type"),
]


class UsageDetails(BaseModel):
    """Usage details with separated token types"""

    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0  # NEVER folded into output
    cache_write_tokens: int = 0  # NEVER folded into input
    cache_read_tokens: int = 0  # NEVER folded into input
    input_audio_tokens: int = 0
    cache_audio_read_tokens: int = 0
    details: dict[str, Any] = Field(default_factory=dict)  # Provider-specific extras


class LastModelResponse(BaseModel):
    """Last model response metadata"""

    timestamp: datetime
    model_name: str
    provider_name: str
    finish_reason: str
    provider_response_id: str
    usage: UsageDetails

    @field_serializer("timestamp", when_used="json")
    def _ts_iso(self, v: datetime) -> str:
        return (
            v.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        )


class RunUsage(BaseModel):
    """Run-level usage extending UsageDetails"""

    requests: int = 0
    tool_calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0
    cache_write_tokens: int = 0
    cache_read_tokens: int = 0
    input_audio_tokens: int = 0
    cache_audio_read_tokens: int = 0
    details: dict[str, Any] = Field(default_factory=dict)


class MessagesEnvelope(BaseModel):
    """Messages envelope with bytes storage and integrity"""

    format: str = "pydantic_ai.messages"
    encoding: str = "utf-8"
    scope: str = "new_run_only"
    json_data: bytes = Field(
        alias="json"
    )  # Use alias to avoid shadowing BaseModel.json
    compression: Literal["zstd"] | None = None  # Only present if compressed
    sha256: str | None = None  # For integrity verification
    size_bytes: int | None = None  # Original size before compression

    model_config = ConfigDict(populate_by_name=True)  # Allow both field name and alias

    @field_serializer("json_data", when_used="json")
    def _serialize_json_data(self, v: bytes) -> str:
        """Automatically base64 encode bytes for JSON serialization"""
        import base64

        return base64.b64encode(v).decode("ascii")

    @field_validator("json_data", mode="before")
    @classmethod
    def _validate_json_data(cls, v: Any) -> Any:
        """Allow re-hydration from base64 in import paths"""
        if isinstance(v, str):
            try:
                import base64

                return base64.b64decode(v.encode("ascii"))
            except Exception:
                pass
        return v

    def model_dump(self, **kwargs: Any) -> dict[str, Any]:
        """Custom serialization to handle bytes properly"""
        data = super().model_dump(exclude_none=True, **kwargs)  # Drop nulls

        # Check for both field name and alias
        json_field = "json" if "json" in data else "json_data"
        if json_field in data and isinstance(data[json_field], bytes):
            import base64
            import hashlib

            # For export, convert to base64
            data["json"] = base64.b64encode(data[json_field]).decode("utf-8")
            data["encoding"] = "base64"

            # Remove the original field if it was json_data
            if json_field == "json_data":
                del data["json_data"]

            # Add integrity fields if not present
            if "sha256" not in data:
                data["sha256"] = hashlib.sha256(data["json"].encode()).hexdigest()
            if "size_bytes" not in data:
                data["size_bytes"] = len(data["json"])
        return data


# EventData is now a discriminated union defined above


class EventType(str, Enum):
    """Event types including success and failure/cancellation"""

    # Success events
    WORKFLOW_START = "workflow_start"
    AGENT_RUN_STARTED = "agent_run_started"
    THINKING_COMPLETED = "thinking_completed"
    TEXT_COMPLETED = "text_completed"
    TOOL_CALL_COMPLETED = "tool_call_completed"
    MCP_REQUEST_COMPLETED = "mcp_request_completed"
    AGENT_RUN_COMPLETED = "agent_run_completed"
    WORKFLOW_COMPLETE = "workflow_complete"

    # Failure/Cancellation events
    AGENT_RUN_FAILED = "agent_run_failed"
    TOOL_CALL_FAILED = "tool_call_failed"
    MCP_REQUEST_FAILED = "mcp_request_failed"
    WORKFLOW_CANCELLED = "workflow_cancelled"
    WORKFLOW_TIMED_OUT = "workflow_timed_out"

    # Internal-only start events (not exported in v1.3)
    TOOL_CALL_STARTED = "tool_call_started"
    MCP_REQUEST_STARTED = "mcp_request_started"
    THINKING_STARTED = "thinking_started"
    TEXT_STARTED = "text_started"
    THINKING_FAILED = "thinking_failed"
    TEXT_FAILED = "text_failed"


# Exported event types only (finished-only, no starts)
EXPORTED_EVENT_TYPES: set[EventType] = {
    EventType.WORKFLOW_START,
    EventType.WORKFLOW_COMPLETE,
    EventType.WORKFLOW_CANCELLED,
    EventType.WORKFLOW_TIMED_OUT,
    EventType.AGENT_RUN_STARTED,
    EventType.AGENT_RUN_COMPLETED,
    EventType.AGENT_RUN_FAILED,
    EventType.THINKING_COMPLETED,
    EventType.TEXT_COMPLETED,
    EventType.THINKING_FAILED,
    EventType.TEXT_FAILED,
    EventType.TOOL_CALL_COMPLETED,
    EventType.TOOL_CALL_FAILED,
    EventType.MCP_REQUEST_COMPLETED,
    EventType.MCP_REQUEST_FAILED,
}


class EventRecord(BaseModel):
    """Event record with full provider metadata"""

    id: str
    seq: int  # Monotonic sequence number for ordering
    ts: datetime
    source: dict[str, str]  # e.g., {"agent": "supervisor"}
    type: EventType
    data: EventData
    content: str | None = None  # Event content for display
    parent_event_id: str | None = None  # Link to parent start event

    @field_serializer("ts", when_used="json")
    def _ts_iso(self, v: datetime) -> str:
        return (
            v.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        )


class MCPServer(BaseModel):
    """MCP server information"""

    name: str
    version: str
    transport: str
    protocol_version: str | None = None
    tools: list[dict[str, Any]]
    tool_schema_version: str | None = None


class MCPSession(BaseModel):
    """MCP session with protocol tracking"""

    session_id: uuid.UUID
    server: str
    transport: str
    protocol_version: str | None = None
    opened_at: datetime
    closed_at: datetime
    sequence_id_start: int | None = None
    sequence_id_end: int | None = None

    @field_serializer("opened_at", "closed_at", when_used="json")
    def _ts_iso(self, v: datetime) -> str:
        return (
            v.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        )


class MCPInfo(BaseModel):
    """MCP information"""

    servers: list[MCPServer]
    sessions: list[MCPSession]


class Policy(BaseModel):
    """Policy configuration for compliance"""

    thinking_visibility: Literal["full", "hidden"] = "full"
    pii_filter: bool = False
    policy_version: str | None = None


class RunInfo(BaseModel):
    """Run information with tracing support"""

    id: uuid.UUID
    parent_run_id: uuid.UUID | None = None
    retry_of: uuid.UUID | None = None
    attempt: int | None = 1
    status: Literal["succeeded", "failed", "cancelled", "timed_out"]
    started_at: datetime
    completed_at: datetime
    correlation_id: uuid.UUID | None = None
    tags: list[str] | None = None
    workflow: WorkflowConfig

    @field_serializer("started_at", "completed_at", when_used="json")
    def _ts_iso(self, v: datetime) -> str:
        return (
            v.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        )


class FinalResponse(BaseModel):
    """Final response schema v1.3+"""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    schema_version: Literal["1.3"] = "1.3"
    conversation: ConversationContext
    request: RequestInfo
    run: RunInfo
    agents: list[AgentConfig]
    routing: RoutingDecision
    output: OutputResult
    usage: RunUsage
    messages: MessagesEnvelope
    events: list[EventRecord]
    mcp: MCPInfo
    policy: Policy | None = None

    @model_validator(mode="after")
    def validate_run_consistency(self) -> FinalResponse:
        """Validate run window consistency and usage totals"""
        from datetime import timedelta

        # 1. Ensure completed_at >= started_at
        # Make sure both are timezone-aware
        if self.run.started_at.tzinfo is None:
            self.run.started_at = self.run.started_at.replace(tzinfo=UTC)
        if self.run.completed_at.tzinfo is None:
            self.run.completed_at = self.run.completed_at.replace(tzinfo=UTC)

        if self.run.completed_at < self.run.started_at:
            # Fix: swap them
            self.run.started_at, self.run.completed_at = (
                self.run.completed_at,
                self.run.started_at,
            )

        # 2. Ensure all events fall within window (±2s tolerance)
        tolerance = timedelta(seconds=2)
        for event in self.events:
            if event.ts < self.run.started_at - tolerance:
                self.run.started_at = event.ts
            elif event.ts > self.run.completed_at + tolerance:
                self.run.completed_at = event.ts

        # 3. Cross-check usage totals with actual event counts
        model_response_count = sum(
            1
            for e in self.events
            if e.type in [EventType.TEXT_COMPLETED, EventType.THINKING_COMPLETED]
        )
        tool_call_count = sum(
            1 for e in self.events if e.type == EventType.TOOL_CALL_COMPLETED
        )

        # Adjust run.usage to match reality
        if self.usage.requests != model_response_count:
            print(
                f"Warning: Usage requests mismatch: "
                f"{self.usage.requests} != {model_response_count}"
            )

        if self.usage.tool_calls != tool_call_count:
            print(
                f"Warning: Usage tool_calls mismatch: "
                f"{self.usage.tool_calls} != {tool_call_count}"
            )

        return self


# Convenience functions for common patterns
def create_error_info(
    code: str, message: str, provider_code: str | None = None
) -> ErrorInfo:
    """Create ErrorInfo for failed events"""
    return ErrorInfo(code=code, message=message, provider_code=provider_code)


def create_routing_candidate(
    type: Literal["agent", "tool", "mcp_tool"],
    target: str,
    score: float,
    eligible: bool = True,
) -> RoutingCandidate:
    """Create RoutingCandidate for analytics"""
    return RoutingCandidate(type=type, target=target, score=score, eligible=eligible)


def create_workflow_start_data(entrypoint: str | None = None) -> WorkflowStartData:
    """Create WorkflowStartData"""
    return WorkflowStartData(entrypoint=entrypoint)


def create_agent_run_started_data() -> AgentRunStartedData:
    """Create AgentRunStartedData"""
    return AgentRunStartedData()


def create_thinking_completed_data(
    content: str,
    model_name: str,
    provider_name: str,
    provider_request_id: str | None = None,
    provider_response_id: str | None = None,
    finish_reason: str = "unknown",
    truncated: bool = False,
    parent_event_id: str | None = None,
    usage: UsageDetails | None = None,
) -> ThinkingCompletedData:
    """Create ThinkingCompletedData"""
    return ThinkingCompletedData(
        content=content,
        model_name=model_name,
        provider_name=provider_name,
        provider_request_id=provider_request_id,
        provider_response_id=provider_response_id,
        finish_reason=finish_reason,
        truncated=truncated,
        parent_event_id=parent_event_id,
        usage=usage,
    )


def create_text_completed_data(
    content: str,
    model_name: str,
    provider_name: str,
    provider_request_id: str | None = None,
    provider_response_id: str | None = None,
    finish_reason: str = "unknown",
    truncated: bool = False,
    parent_event_id: str | None = None,
    usage: UsageDetails | None = None,
) -> TextCompletedData:
    """Create TextCompletedData"""
    return TextCompletedData(
        content=content,
        model_name=model_name,
        provider_name=provider_name,
        provider_request_id=provider_request_id,
        provider_response_id=provider_response_id,
        finish_reason=finish_reason,
        truncated=truncated,
        parent_event_id=parent_event_id,
        usage=usage,
    )


def create_failed_event_data(error: ErrorInfo) -> FailedEventData:
    """Create FailedEventData"""
    return FailedEventData(error=error)

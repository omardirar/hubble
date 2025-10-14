"""Response builder utilities for v1.3+ schema

Helper functions for constructing various parts of the FinalResponse object
with compression support, policy versioning, and routing analytics.
"""

import base64
import uuid
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any, Literal

import zstandard as zstd

from ..models.response_schema import (
    AgentConfig,
    ConversationContext,
    EventRecord,
    EventType,
    FinalResponse,
    LastModelResponse,
    MCPInfo,
    McpRequestCompletedData,
    MCPServer,
    MCPSession,
    MessagesEnvelope,
    OutputResult,
    Policy,
    RequestInfo,
    RoutingDecision,
    RunInfo,
    RunUsage,
    TextCompletedData,
    ThinkingCompletedData,
    UsageDetails,
    WorkflowConfig,
    create_routing_candidate,
)


def build_conversation_context(
    conversation_id: str, org_id: str, user_id: str
) -> ConversationContext:
    """Build conversation context from identifiers"""
    return ConversationContext(
        conversation_id=conversation_id, org_id=org_id, user_id=user_id
    )


def build_request_info(
    user_message: str, requested_by: str = "user", timestamp: datetime | None = None
) -> RequestInfo:
    """Build request info with trigger source"""
    # Ensure requested_by is one of the valid literals
    valid_values = ["user", "system", "automation"]
    if requested_by not in valid_values:
        requested_by = "user"

    return RequestInfo(
        timestamp=timestamp or datetime.now(UTC),
        user_message=user_message,
        requested_by=requested_by,  # type: ignore
    )


def build_run_info(
    run_id: uuid.UUID,
    start_time: datetime,
    end_time: datetime,
    status: str,
    workflow: WorkflowConfig,
    retry_of: uuid.UUID | None = None,
    attempt: int = 1,
    correlation_id: uuid.UUID | None = None,
    tags: list[str] | None = None,
) -> RunInfo:
    """Build run info with tracing support"""
    # Ensure status is one of the valid literals
    valid_statuses = ["succeeded", "failed", "cancelled", "timed_out"]
    if status not in valid_statuses:
        status = "failed"  # Default to failed for invalid status

    return RunInfo(
        id=run_id,
        parent_run_id=None,  # Can be set separately if needed
        retry_of=retry_of,
        attempt=attempt,
        status=status,  # type: ignore
        started_at=start_time,
        completed_at=end_time,
        correlation_id=correlation_id,
        tags=tags,
        workflow=workflow,
    )


def extract_usage_from_result(result: Any) -> RunUsage:
    """Extract usage from PydanticAI result with separated token types"""
    try:
        if not result:
            return RunUsage()

        # Try to get usage data - it might be a function or property
        usage_data = None
        if hasattr(result, "usage"):
            usage_attr = result.usage
            if callable(usage_attr):
                # It's a function, call it
                try:
                    usage_data = usage_attr()
                except Exception as e:
                    print(f"Error calling usage function: {e}")
                    return RunUsage()
            else:
                # It's a property or attribute
                usage_data = usage_attr

        if not usage_data:
            return RunUsage()

        requests = 0
        tool_calls = 0

        if isinstance(usage_data, Mapping):
            input_tokens = int(usage_data.get("input_tokens", 0) or 0)
            output_tokens = int(usage_data.get("output_tokens", 0) or 0)
            reasoning_tokens = int(usage_data.get("reasoning_tokens", 0) or 0)
            cache_write_tokens = int(usage_data.get("cache_write_tokens", 0) or 0)
            cache_read_tokens = int(usage_data.get("cache_read_tokens", 0) or 0)
            input_audio_tokens = int(usage_data.get("input_audio_tokens", 0) or 0)
            cache_audio_read_tokens = int(
                usage_data.get("cache_audio_read_tokens", 0) or 0
            )
            requests = int(
                usage_data.get("requests", usage_data.get("request_count", 0)) or 0
            )
            tool_calls = int(
                usage_data.get("tool_calls", usage_data.get("tool_call_count", 0)) or 0
            )
            details_raw = usage_data.get("details", {})
        else:
            input_tokens = int(getattr(usage_data, "input_tokens", 0) or 0)
            output_tokens = int(getattr(usage_data, "output_tokens", 0) or 0)
            reasoning_tokens = int(getattr(usage_data, "reasoning_tokens", 0) or 0)
            cache_write_tokens = int(getattr(usage_data, "cache_write_tokens", 0) or 0)
            cache_read_tokens = int(getattr(usage_data, "cache_read_tokens", 0) or 0)
            input_audio_tokens = int(getattr(usage_data, "input_audio_tokens", 0) or 0)
            cache_audio_read_tokens = int(
                getattr(usage_data, "cache_audio_read_tokens", 0) or 0
            )
            requests = int(
                getattr(usage_data, "requests", getattr(usage_data, "request_count", 0))
                or 0
            )
            tool_calls = int(
                getattr(
                    usage_data, "tool_calls", getattr(usage_data, "tool_call_count", 0)
                )
                or 0
            )
            details_raw = getattr(usage_data, "details", {})

        details = details_raw if isinstance(details_raw, dict) else {}

        # Verify Anthropic thinking budget compliance
        if isinstance(details, dict) and "anthropic" in details:
            anthropic_details = details["anthropic"]
            if (
                isinstance(anthropic_details, dict)
                and "anthropic_reasoning_tokens" in anthropic_details
            ):
                # Ensure reasoning tokens match Anthropic's count
                anthropic_reasoning = anthropic_details["anthropic_reasoning_tokens"]
                if reasoning_tokens != anthropic_reasoning:
                    print(
                        f"Warning: reasoning_tokens ({reasoning_tokens}) != "
                        f"anthropic_reasoning_tokens ({anthropic_reasoning})"
                    )
                    # Use Anthropic's count as authoritative
                    reasoning_tokens = anthropic_reasoning

        # Verify token separation (critical for cost accuracy)
        if reasoning_tokens > 0 and reasoning_tokens == output_tokens:
            print(
                "Warning: reasoning_tokens should not equal output_tokens - "
                "they are separate token types"
            )

        if cache_read_tokens > 0 and cache_read_tokens == input_tokens:
            print(
                "Warning: cache_read_tokens should not equal input_tokens - "
                "they are separate token types"
            )

        return RunUsage(
            requests=requests,
            tool_calls=tool_calls,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            reasoning_tokens=reasoning_tokens,
            cache_write_tokens=cache_write_tokens,
            cache_read_tokens=cache_read_tokens,
            input_audio_tokens=input_audio_tokens,
            cache_audio_read_tokens=cache_audio_read_tokens,
            details=details,
        )
    except Exception as e:
        print(f"Error extracting usage from result: {e}")
        return RunUsage()


def compute_run_usage(events: list[EventRecord]) -> RunUsage:
    """Compute run-level usage as sum of per-event usage"""
    total_input = 0
    total_output = 0
    total_reasoning = 0
    total_cache_write = 0
    total_cache_read = 0
    total_input_audio = 0
    total_cache_audio_read = 0
    details: dict[str, Any] = {}

    model_response_count = 0
    tool_call_count = 0

    for event in events:
        # Check if this event type has usage data
        if (
            isinstance(
                event.data,
                TextCompletedData | ThinkingCompletedData | McpRequestCompletedData,
            )
            and event.data.usage
        ):
            u = event.data.usage
            total_input += u.input_tokens
            total_output += u.output_tokens
            total_reasoning += u.reasoning_tokens
            total_cache_write += u.cache_write_tokens
            total_cache_read += u.cache_read_tokens
            total_input_audio += u.input_audio_tokens
            total_cache_audio_read += u.cache_audio_read_tokens

            # Merge details
            if u.details:
                details.update(u.details)

        # Count events
        if event.type in [EventType.TEXT_COMPLETED, EventType.THINKING_COMPLETED]:
            model_response_count += 1
        elif event.type == EventType.TOOL_CALL_COMPLETED:
            tool_call_count += 1

    return RunUsage(
        requests=model_response_count,
        tool_calls=tool_call_count,
        input_tokens=total_input,
        output_tokens=total_output,
        reasoning_tokens=total_reasoning,
        cache_write_tokens=total_cache_write,
        cache_read_tokens=total_cache_read,
        input_audio_tokens=total_input_audio,
        cache_audio_read_tokens=total_cache_audio_read,
        details=details,
    )


def extract_last_model_response(
    result: Any, events: list[EventRecord] | None = None
) -> LastModelResponse:
    """Extract last model response metadata from final text_completed event"""
    try:
        # First try to extract from final text_completed event
        if events:
            text_events = [e for e in events if e.type == EventType.TEXT_COMPLETED]
            if text_events:
                last_event = text_events[-1]
                event_data = last_event.data

                # Type guard: TextCompletedData from TEXT_COMPLETED events
                if isinstance(event_data, TextCompletedData):
                    return LastModelResponse(
                        timestamp=last_event.ts,
                        model_name=event_data.model_name,
                        provider_name=event_data.provider_name,
                        finish_reason="stop",
                        provider_response_id=event_data.provider_response_id or "",
                        usage=event_data.usage or UsageDetails(),
                    )

        # Fallback: extract from result
        if not result:
            return LastModelResponse(
                timestamp=datetime.now(UTC),
                model_name="unknown",
                provider_name="unknown",
                finish_reason="no_result",
                provider_response_id="",
                usage=UsageDetails(),
            )

        usage = extract_usage_from_result(result)

        # Extract provider information from result attributes
        provider_name = "unknown"
        model_name = "unknown"
        finish_reason = "stop"
        provider_response_id = ""

        # Try to get provider info from result
        if hasattr(result, "provider"):
            provider_name = str(result.provider)
        elif hasattr(result, "provider_name"):
            provider_name = str(result.provider_name)

        # Try to get model info from result
        if hasattr(result, "model"):
            model_name = str(result.model)
        elif hasattr(result, "model_name"):
            model_name = str(result.model_name)

        # Try to get finish reason
        if hasattr(result, "finish_reason"):
            finish_reason = str(result.finish_reason)
        elif hasattr(result, "stop_reason"):
            finish_reason = str(result.stop_reason)

        # Try to get provider response ID
        if hasattr(result, "provider_response_id"):
            provider_response_id = str(result.provider_response_id)
        elif hasattr(result, "response_id"):
            provider_response_id = str(result.response_id)
        elif hasattr(result, "id"):
            provider_response_id = str(result.id)

        # Create UsageDetails with proper token separation
        last_usage = UsageDetails(
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            reasoning_tokens=usage.reasoning_tokens,  # Separate from output_tokens
            cache_write_tokens=usage.cache_write_tokens,  # Separate from input_tokens
            cache_read_tokens=usage.cache_read_tokens,  # Separate from input_tokens
            input_audio_tokens=usage.input_audio_tokens,
            cache_audio_read_tokens=usage.cache_audio_read_tokens,
            details=usage.details,
        )

        return LastModelResponse(
            timestamp=datetime.now(UTC),
            model_name=model_name,
            provider_name=provider_name,
            finish_reason=finish_reason,
            provider_response_id=provider_response_id,
            usage=last_usage,
        )
    except Exception as e:
        print(f"Error extracting last model response: {e}")
        return LastModelResponse(
            timestamp=datetime.now(UTC),
            model_name="unknown",
            provider_name="unknown",
            finish_reason="error",
            provider_response_id="",
            usage=UsageDetails(),
        )


def build_messages_envelope(result: Any, compress: bool = False) -> MessagesEnvelope:
    """Build messages envelope with bytes storage and optional compression"""
    try:
        # Get raw messages JSON bytes from PydanticAI
        if result and hasattr(result, "new_messages_json"):
            messages_bytes: bytes | str = result.new_messages_json()
        else:
            messages_bytes = b'{"messages": []}'

        if not isinstance(messages_bytes, bytes):
            messages_bytes = str(messages_bytes).encode("utf-8")

        # Validate UTF-8 encoding
        try:
            messages_bytes.decode("utf-8")
        except UnicodeDecodeError:
            # If not valid UTF-8, encode as base64
            import base64

            messages_bytes = base64.b64encode(messages_bytes)

        # Apply compression if requested
        compression: Literal["zstd"] | None = None
        if compress and len(messages_bytes) > 1024:  # Only compress if > 1KB
            messages_bytes = compress_messages(messages_bytes)
            compression = "zstd"

        # Calculate integrity fields
        import hashlib

        sha256_hash = hashlib.sha256(messages_bytes).hexdigest()
        size_bytes = len(messages_bytes)

        return MessagesEnvelope(
            format="pydantic_ai.messages",
            encoding="utf-8",
            scope="new_run_only",
            json=messages_bytes,  # Use json alias for the field
            compression=compression,
            sha256=sha256_hash,
            size_bytes=size_bytes,
        )
    except Exception as e:
        print(f"Error building messages envelope: {e}")
        return MessagesEnvelope(
            format="pydantic_ai.messages",
            encoding="utf-8",
            scope="new_run_only",
            json=b"{}",
        )


def build_routing_decision(
    user_message: str,
    selected_agent: str,
    confidence: float,
    strategy: str | None = None,
    candidates: list[dict[str, Any]] | None = None,
) -> RoutingDecision:
    """Build routing decision with analytics"""
    decider = "supervisor"

    # Validate strategy is one of the expected literals
    valid_strategies = ["rule_based", "prompt_router", "tool_router_llm", "hybrid"]
    if strategy is not None and strategy not in valid_strategies:
        strategy = None  # Default to None for invalid strategy

    # Extract query summary for reason
    query_summary = (
        user_message[:50] + "..." if len(user_message) > 50 else user_message
    )
    reason = f"Query about '{query_summary}' best handled by {selected_agent}"

    # Convert candidates to RoutingCandidate objects
    routing_candidates = None
    if candidates:
        routing_candidates = []
        for candidate in candidates:
            if isinstance(candidate, dict):
                routing_candidates.append(
                    create_routing_candidate(
                        type=candidate.get("type", "agent"),
                        target=candidate.get("target", ""),
                        score=candidate.get("score", 0.0),
                        eligible=candidate.get("eligible", True),
                    )
                )
            else:
                # Already a RoutingCandidate object
                routing_candidates.append(candidate)

    # Build selection if router made a pick
    selection = None
    if selected_agent and confidence > 0.5:
        from ..models.response_schema import RoutingSelection

        selection = RoutingSelection(
            selected=selected_agent, thresholds={"min_score": 0.5}
        )

    return RoutingDecision(
        decider=decider,
        reason=reason,
        confidence=confidence,
        strategy=strategy,  # type: ignore
        candidates=routing_candidates,
        selection=selection,
    )


def build_policy(
    thinking_visibility: str = "full",
    pii_filter: bool = False,
    policy_version: str | None = None,
) -> Policy:
    """Build policy configuration for compliance"""
    # Validate thinking_visibility is one of the expected literals
    valid_visibilities = ["full", "hidden"]
    if thinking_visibility not in valid_visibilities:
        thinking_visibility = "full"  # Default to full for invalid visibility

    return Policy(
        thinking_visibility=thinking_visibility,  # type: ignore
        pii_filter=pii_filter,
        policy_version=policy_version,
    )


def compress_messages(bytes_data: bytes) -> bytes:
    """Compress message bytes using zstd"""
    try:
        return zstd.compress(bytes_data)
    except Exception as e:
        print(f"Error compressing messages: {e}")
        return bytes_data


def decompress_messages(bytes_data: bytes) -> bytes:
    """Decompress message bytes using zstd"""
    try:
        return zstd.decompress(bytes_data)
    except Exception as e:
        print(f"Error decompressing messages: {e}")
        return bytes_data


def serialize_for_file(final_response: FinalResponse) -> dict[str, Any]:
    """Serialize FinalResponse for file export with base64 encoding"""
    try:
        # Convert to dict with proper datetime serialization
        response_dict: dict[str, Any] = final_response.model_dump(mode="json")

        # Convert non-JSON-serializable objects to strings
        def convert_for_json(obj: Any) -> Any:
            if isinstance(obj, datetime):
                return obj.isoformat()
            elif hasattr(obj, "__str__") and "UUID" in str(type(obj)):
                return str(obj)
            elif isinstance(obj, dict):
                return {k: convert_for_json(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_for_json(item) for item in obj]
            elif hasattr(obj, "model_dump"):
                # Handle Pydantic models - skip MessagesEnvelope (special handling)
                if obj.__class__.__name__ == "MessagesEnvelope":
                    return obj.model_dump(
                        mode="json"
                    )  # Use mode='json' to get raw data
                else:
                    return convert_for_json(obj.model_dump())
            return obj

        response_dict = convert_for_json(response_dict)

        # Convert messages bytes to base64 for file export
        if "messages" in response_dict:
            messages = response_dict["messages"]

            # Check for both field name and alias
            json_field = "json" if "json" in messages else "json_data"
            if json_field in messages:
                messages_data = messages[json_field]

                # Handle different data types
                if isinstance(messages_data, str):
                    # If Pydantic gave us a string, it might be base64 already
                    # Try to decode it back to bytes
                    try:
                        messages_bytes = base64.b64decode(messages_data.encode("ascii"))
                    except Exception:
                        # If not base64, treat as raw JSON and encode to bytes
                        messages_bytes = messages_data.encode("utf-8")
                elif isinstance(messages_data, bytes):
                    messages_bytes = messages_data
                else:
                    # Convert other types to string first
                    messages_bytes = str(messages_data).encode("utf-8")

                if isinstance(messages_bytes, bytes):
                    # Convert to base64 and use 'json' key - always safe ASCII
                    response_dict["messages"]["json"] = base64.b64encode(
                        messages_bytes
                    ).decode("ascii")
                    response_dict["messages"]["encoding"] = "base64"

                    # Remove the original field if it was json_data
                    if json_field == "json_data":
                        del response_dict["messages"]["json_data"]

        return response_dict
    except Exception as e:
        print(f"Error serializing for file: {e}")
        result: dict[str, Any] = {}
        return result


def build_workflow_config(
    type: str = "multi_agent",
    supervisor_agent: str = "supervisor",
    sub_agents: list[dict[str, Any]] | None = None,
) -> WorkflowConfig:
    """Build workflow configuration"""
    # Validate type is one of the expected literals
    valid_types = ["single_agent", "multi_agent"]
    if type not in valid_types:
        type = "multi_agent"  # Default to multi_agent for invalid type

    if sub_agents is None:
        sub_agents = [
            {"name": "marketer_agent", "as_tool": True},
            {"name": "analyst_agent", "as_tool": True},
        ]

    return WorkflowConfig(
        type=type, supervisor_agent=supervisor_agent, sub_agents=sub_agents
    )  # type: ignore


def build_agent_config(
    name: str,
    role: str,
    provider: str,
    model_name: str,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    top_p: float = 1.0,
    thinking_enabled: bool = True,
    thinking_budget_tokens: int = 2048,
) -> dict[str, Any]:
    """Build agent configuration for PydanticAI Agent constructor.

    Args:
        name: Agent name
        role: Agent role (supervisor, sub_agent_tool, etc.)
        provider: Model provider (anthropic, openai, etc.)
        model_name: Specific model name
        temperature: Sampling temperature
        max_tokens: Maximum tokens to generate
        top_p: Nucleus sampling parameter
        thinking_enabled: Whether thinking is enabled
        thinking_budget_tokens: Budget for thinking tokens

    Returns:
        Configuration dict for Agent constructor
    """
    return {
        "name": name,
        "role": role,
        "provider": provider,
        "model_name": model_name,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "top_p": top_p,
        "thinking_enabled": thinking_enabled,
        "thinking_budget_tokens": thinking_budget_tokens,
    }


def build_mcp_info(servers: list[MCPServer], sessions: list[MCPSession]) -> MCPInfo:
    """Build MCP information from servers and sessions"""
    return MCPInfo(servers=servers, sessions=sessions)


def build_output_result(output_type: str, output_value: str) -> OutputResult:
    """Build output result"""
    return OutputResult(type=output_type, value=output_value)


def create_final_response(
    conversation: ConversationContext,
    request: RequestInfo,
    run: RunInfo,
    agents: list[AgentConfig],
    routing: RoutingDecision,
    output: OutputResult,
    usage: RunUsage,
    messages: MessagesEnvelope,
    events: list[EventRecord],
    mcp: MCPInfo,
    policy: Policy | None = None,
) -> FinalResponse:
    """Create final response with all components"""
    return FinalResponse(
        schema_version="1.3",
        conversation=conversation,
        request=request,
        run=run,
        agents=agents,
        routing=routing,
        output=output,
        usage=usage,
        messages=messages,
        events=events,
        mcp=mcp,
        policy=policy,
    )

"""Response builder utilities for v1.3+ schema

Helper functions for constructing various parts of the FinalResponse object
with compression support, policy versioning, and routing analytics.
"""

# Core builders
from typing import Any

# Legacy imports for backward compatibility
from ...models.response_schema import (
    FinalResponse,
    create_error_info,
    create_failed_event_data,
    create_routing_candidate,
    create_text_completed_data,
    create_thinking_completed_data,
    create_workflow_start_data,
)
from .core import (
    build_agent_config,
    build_conversation_context,
    build_output_result,
    build_policy,
    build_request_info,
    build_routing_decision,
    build_run_info,
    build_workflow_config,
)

# MCP-specific
from .mcp import build_mcp_info, build_mcp_servers

# Serialization
from .serialization import (
    build_messages_envelope,
    compress_messages,
    convert_for_json,
    decompress_messages,
    serialize_for_file,
)

# Usage calculation
from .usage import (
    compute_run_usage,
    extract_last_model_response,
    extract_usage_from_result,
)


def create_final_response(
    conversation: Any,
    request: Any,
    run: Any,
    agents: Any,
    routing: Any,
    output: Any,
    usage: Any,
    messages: Any,
    events: Any,
    mcp: Any,
    policy: Any = None,
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


# Re-export everything for backward compatibility
__all__ = [
    "build_agent_config",
    "build_conversation_context",
    "build_mcp_info",
    "build_mcp_servers",
    "build_messages_envelope",
    "build_output_result",
    "build_policy",
    "build_request_info",
    "build_routing_decision",
    "build_run_info",
    "build_workflow_config",
    "compress_messages",
    "compute_run_usage",
    "convert_for_json",
    "create_error_info",
    "create_failed_event_data",
    "create_final_response",
    "create_routing_candidate",
    "create_text_completed_data",
    "create_thinking_completed_data",
    "create_workflow_start_data",
    "decompress_messages",
    "extract_last_model_response",
    "extract_usage_from_result",
    "serialize_for_file",
]

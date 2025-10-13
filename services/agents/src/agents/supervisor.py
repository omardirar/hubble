"""Supervisor agent with tool delegation pattern"""

import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ToolCallPart
from pydantic_ai.run import AgentRunResult
from pydantic_ai.usage import UsageLimits

from ..mcp_client.session import get_session_tracker
from ..models import EventType
from ..models.event_tracker import EventTracker
from ..models.response_schema import (
    AgentConfig,
    AgentRunStartedData,
    EventRecord,
    MCPInfo,
    ModelConfig,
    ModelSettings,
    RoutingCandidate,
    RoutingDecision,
    ToolCallCompletedData,
    ToolCallStartedData,
    create_error_info,
    create_failed_event_data,
    create_routing_candidate,
)
from ..models.stream_aggregator import StreamAggregator
from ..utils.response_builder import (
    build_conversation_context,
    build_messages_envelope,
    build_output_result,
    build_policy,
    build_request_info,
    build_routing_decision,
    build_run_info,
    build_workflow_config,
    compute_run_usage,
    create_final_response,
    extract_usage_from_result,
)
from .analyst import get_analyst_agent

# Import delegate agent functions for lazy loading
from .marketer import get_marketer_agent

logger = logging.getLogger(__name__)

# Agent configuration constants for v1.3+ schema
SUPERVISOR_CONFIG = AgentConfig(
    name="supervisor",
    role="supervisor",
    model=ModelConfig(provider="anthropic", name="claude-sonnet-4-20250514"),
    model_settings=ModelSettings(
        temperature=0.2,
        max_tokens=1200,
        top_p=1.0,
        thinking={"enabled": True, "budget_tokens": 2048},
    ),
)

MARKETER_CONFIG = AgentConfig(
    name="marketer_agent",
    role="sub_agent_tool",
    model=ModelConfig(provider="anthropic", name="claude-sonnet-4-20250514"),
    model_settings=ModelSettings(
        temperature=0.2,
        max_tokens=4096,
        top_p=1.0,
        thinking={"enabled": True, "budget_tokens": 2048},
    ),
)

ANALYST_CONFIG = AgentConfig(
    name="analyst_agent",
    role="sub_agent_tool",
    model=ModelConfig(provider="anthropic", name="claude-sonnet-4-20250514"),
    model_settings=ModelSettings(
        temperature=0.2,
        max_tokens=8192,
        top_p=1.0,
        thinking={"enabled": True, "budget_tokens": 4096},
    ),
)

DEFAULT_AGENT_CONFIGS: dict[str, AgentConfig] = {
    cfg.name: cfg for cfg in (SUPERVISOR_CONFIG, MARKETER_CONFIG, ANALYST_CONFIG)
}

TOOL_TO_AGENT: dict[str, str] = {
    "provide_marketing_advice": "marketer_agent",
    "analyze_data": "analyst_agent",
}


def get_supervisor_agent() -> Agent[EventTracker, str]:
    """Get supervisor agent with runtime model initialization"""
    return Agent(
        "claude-sonnet-4-20250514",
        name="supervisor",
        deps_type=EventTracker,
        system_prompt=(
            "You are a marketing supervisor. Analyze the user query and "
            "delegate specific tasks to specialized agents using the "
            "available tools. Then synthesize their responses into a "
            "comprehensive final answer."
        ),
        tools=[provide_marketing_advice, analyze_data],
    )


# Tool functions - defined without decorators for lazy loading
async def provide_marketing_advice(
    ctx: RunContext[EventTracker], query: str, context: str | None = None
) -> str:
    """Delegate marketing questions to the marketer agent"""
    # Log tool call start
    tool_event_id = ctx.deps.add_event(
        event_type=EventType.TOOL_CALL_STARTED,
        agent="supervisor",
        content=f"Calling provide_marketing_advice tool with query: {query[:100]}",
        metadata=ToolCallStartedData(
            tool_kind="function",
            tool_name="provide_marketing_advice",
            tool_call_id="",
            args={"query": query, "context": context},
        ),
    )

    try:
        # Emit agent_run_started (NOT workflow_start)
        ctx.deps.add_event(
            event_type=EventType.AGENT_RUN_STARTED,
            agent="marketer_agent",
            content="Starting marketer_agent execution",
            metadata=AgentRunStartedData(),
        )

        # Delegate to marketer agent (following Pydantic AI docs)
        marketer_agent = get_marketer_agent()  # Create agent at runtime
        result = await marketer_agent.run(
            query,
            deps=ctx.deps,  # type: ignore[arg-type]
            usage=ctx.usage,  # Pass usage tracking
            usage_limits=UsageLimits(request_limit=5, total_tokens_limit=2000),
        )
        record_result = getattr(ctx.deps, "record_agent_result", None)
        if callable(record_result):
            record_result("marketer_agent", result)

        aggregator_factory = getattr(ctx.deps, "get_stream_aggregator", None)
        aggregator = aggregator_factory() if callable(aggregator_factory) else None
        if aggregator is not None:
            await aggregator.synthesize_for_agent("marketer_agent", result)  # type: ignore[attr-defined]
        else:
            ctx.deps.add_agent_run_completed("marketer_agent")

        # Log tool completion
        ctx.deps.add_event(
            event_type=EventType.TOOL_CALL_COMPLETED,
            agent="supervisor",
            content="provide_marketing_advice tool completed successfully",
            metadata=ToolCallCompletedData(
                tool_kind="function",
                tool_name="provide_marketing_advice",
                tool_call_id=tool_event_id,
                args={"query": query, "context": context},
                result={"output": result.output},
            ),
            parent_event_id=tool_event_id,
        )

        return str(result.output)

    except Exception as e:
        # Emit agent_run_failed (NOT tool_call_error)
        error_code = (
            "total_tokens_limit" if "total_tokens_limit" in str(e) else "UNKNOWN_ERROR"
        )

        ctx.deps.add_event(
            event_type=EventType.AGENT_RUN_FAILED,
            agent="marketer_agent",
            content=f"Error in marketer_agent: {e!s}",
            metadata=create_failed_event_data(
                create_error_info(code=error_code, message=str(e))
            ),
        )

        # Log tool error
        ctx.deps.add_event(
            event_type=EventType.TOOL_CALL_FAILED,
            agent="supervisor",
            content=f"Error in provide_marketing_advice: {e!s}",
            metadata=create_failed_event_data(
                create_error_info(code=type(e).__name__, message=str(e))
            ),
            parent_event_id=tool_event_id,
        )
        return f"Error getting marketing advice: {e!s}"


async def analyze_data(
    ctx: RunContext[EventTracker],
    query: str,
    database_name: str | None = None,
    motherduck_token: str | None = None,
) -> str:
    """Delegate data analysis questions to the analyst agent"""
    # Log tool call start
    tool_event_id = ctx.deps.add_event(
        event_type=EventType.TOOL_CALL_STARTED,
        agent="supervisor",
        content=f"Calling analyze_data tool with query: {query[:100]}",
        metadata=ToolCallStartedData(
            tool_kind="function",
            tool_name="analyze_data",
            tool_call_id="",
            args={"query": query, "database_name": database_name},
        ),
    )

    try:
        # Log delegation event
        ctx.deps.add_event(
            event_type=EventType.AGENT_RUN_STARTED,
            agent="supervisor",
            content="Delegating to analyst_agent for data analysis",
            metadata=AgentRunStartedData(),
            parent_event_id=tool_event_id,
        )

        # Delegate to analyst agent (following Pydantic AI docs)
        analyst_agent = get_analyst_agent()  # Create agent at runtime
        result = await analyst_agent.run(
            query,
            deps=ctx.deps,  # type: ignore[arg-type]
            usage=ctx.usage,  # Pass usage tracking
            usage_limits=UsageLimits(request_limit=5, total_tokens_limit=2000),
        )
        record_result = getattr(ctx.deps, "record_agent_result", None)
        if callable(record_result):
            record_result("analyst_agent", result)

        aggregator_factory = getattr(ctx.deps, "get_stream_aggregator", None)
        aggregator = aggregator_factory() if callable(aggregator_factory) else None
        if aggregator is not None:
            await aggregator.synthesize_for_agent("analyst_agent", result)  # type: ignore[attr-defined]
        else:
            ctx.deps.add_agent_run_completed("analyst_agent")

        # Log completion
        ctx.deps.add_event(
            event_type=EventType.TOOL_CALL_COMPLETED,
            agent="supervisor",
            content="analyze_data tool completed successfully",
            metadata=ToolCallCompletedData(
                tool_kind="function",
                tool_name="analyze_data",
                tool_call_id=tool_event_id,
                args={"query": query, "database_name": database_name},
                result={"output": result.output},
            ),
            parent_event_id=tool_event_id,
        )

        return str(result.output)

    except Exception as e:
        # Log error
        ctx.deps.add_event(
            event_type=EventType.TOOL_CALL_FAILED,
            agent="supervisor",
            content=f"Error in analyze_data: {e!s}",
            metadata=create_failed_event_data(
                create_error_info(code=type(e).__name__, message=str(e))
            ),
            parent_event_id=tool_event_id,
        )
        return f"Error analyzing data: {e!s}"


async def run_supervisor_workflow(
    user_message: str,
    conversation_id: str = "cli-session",
    org_id: str = "cli-org",
    user_id: str = "cli-user",
    motherduck_token: str | None = None,
    database_name: str | None = None,
    mcp_server_url: str | None = None,
    retry_of: uuid.UUID | None = None,
    attempt: int = 1,
    correlation_id: uuid.UUID | None = None,
    requested_by: str = "user",
    policy_version: str = "1.0",
    compress_messages: bool = False,
    test_mode: bool = False,
) -> dict[str, Any]:
    """Run the supervisor workflow with v1.3+ schema and comprehensive tracking"""

    # Generate UUID4 run ID
    run_id = uuid.uuid4()
    start_time = datetime.now(UTC)

    # Create shared event tracker and stream aggregator
    event_tracker: EventTracker = EventTracker()
    stream_aggregator: StreamAggregator = StreamAggregator(event_tracker)
    session_tracker = get_session_tracker()

    # Build conversation context
    conversation = build_conversation_context(conversation_id, org_id, user_id)

    # Build request info
    # Constrain requested_by to allowed literals when possible
    from typing import Literal, cast

    allowed = ("user", "system", "automation")
    rb: str = requested_by if requested_by in allowed else "user"
    rb_lit = cast(Literal["user", "system", "automation"], rb)  # type: ignore[valid-type]
    request = build_request_info(
        user_message, requested_by=rb_lit, timestamp=start_time
    )

    # Build workflow config
    workflow = build_workflow_config(
        type="multi_agent",
        supervisor_agent="supervisor",
        sub_agents=[
            {"name": "marketer_agent", "as_tool": True},
            {"name": "analyst_agent", "as_tool": True},
        ],
    )

    result: AgentRunResult[Any] | None = None

    try:
        # Log workflow start
        event_tracker.add_workflow_start(entrypoint="supervisor_workflow")

        # Create supervisor agent at runtime
        supervisor_agent = get_supervisor_agent()

        # Run supervisor agent with event stream handler
        result = await supervisor_agent.run(
            user_message,
            deps=event_tracker,  # type: ignore[arg-type]
            usage_limits=UsageLimits(request_limit=10, total_tokens_limit=5000),
            event_stream_handler=stream_aggregator.handle_event,  # type: ignore[arg-type]
        )

        # Synthesize non-streaming events if needed
        await stream_aggregator.synthesize_non_streaming(result)
        event_tracker.record_agent_result("supervisor", result)

        # Log workflow completion
        event_tracker.add_workflow_complete(
            status="succeeded", total_events=len(event_tracker.events) + 1
        )

        # Build run info
        end_time = datetime.now(UTC)
        run = build_run_info(
            run_id=run_id,
            started_at=start_time,
            completed_at=end_time,
            status="succeeded",
            workflow=workflow,
            retry_of=retry_of,
            attempt=attempt,
            correlation_id=correlation_id,
            tags=["production", "v1.3"],
        )

        events = event_tracker.to_v1_3_events()
        routing = _build_routing_decision(user_message, event_tracker, events)
        agents = _build_agents_from_tracker(event_tracker)

        usage = extract_usage_from_result(result)
        event_usage = compute_run_usage(events)
        if usage.requests == 0 and usage.tool_calls == 0:
            usage = event_usage
        else:
            usage.requests = max(usage.requests, event_usage.requests)
            usage.tool_calls = max(usage.tool_calls, event_usage.tool_calls)
            usage.input_tokens = max(usage.input_tokens, event_usage.input_tokens)
            usage.output_tokens = max(usage.output_tokens, event_usage.output_tokens)
            usage.reasoning_tokens = max(
                usage.reasoning_tokens, event_usage.reasoning_tokens
            )
            usage.cache_write_tokens = max(
                usage.cache_write_tokens, event_usage.cache_write_tokens
            )
            usage.cache_read_tokens = max(
                usage.cache_read_tokens, event_usage.cache_read_tokens
            )

        # Build output result
        output = build_output_result("text", result.output or "")

        # Build messages envelope with optional compression
        messages = build_messages_envelope(result, compress=compress_messages)

        # Build MCP info
        mcp = MCPInfo(
            servers=session_tracker.get_servers(),
            sessions=session_tracker.get_all_sessions(),
        )

        # Build policy
        policy = build_policy(
            thinking_visibility="full", pii_filter=False, policy_version=policy_version
        )

        # Create final response
        final_response = create_final_response(
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

        # Return serialized response
        response_dict = final_response.model_dump()
        return response_dict
    except Exception as e:
        logger.error(
            "Supervisor workflow error", {"error": str(e), "run_id": str(run_id)}
        )

        # Flush any remaining events
        await stream_aggregator.flush()

        # Log error with comprehensive details
        error_info = create_error_info(code=type(e).__name__, message=str(e))
        event_tracker.add_workflow_cancelled(
            error=error_info, workflow_stage="supervisor_execution", run_id=str(run_id)
        )

        # Build error response
        end_time = datetime.now(UTC)
        run = build_run_info(
            run_id=run_id,
            started_at=start_time,
            completed_at=end_time,
            status="failed",
            workflow=workflow,
            retry_of=retry_of,
            attempt=attempt,
            correlation_id=correlation_id,
            tags=["production", "v1.3", "error"],
        )

        # Build error output
        output = build_output_result("error", f"Error: {e!s}")

        # Build error messages
        messages = build_messages_envelope(
            result if "result" in locals() else None, compress=compress_messages
        )

        # Convert events to v1.3 format
        events_list: list[EventRecord] = event_tracker.to_v1_3_events()
        routing_decision: RoutingDecision = _build_routing_decision(
            user_message, event_tracker, events_list
        )
        agents_list: list[AgentConfig] = _build_agents_from_tracker(event_tracker)
        usage = compute_run_usage(events_list)

        # Build MCP info
        mcp_info: MCPInfo = MCPInfo(
            servers=session_tracker.get_servers(),
            sessions=session_tracker.get_all_sessions(),
        )

        # Build policy
        policy = build_policy(
            thinking_visibility="full", pii_filter=False, policy_version=policy_version
        )

        # Create error response
        final_response = create_final_response(
            conversation=conversation,
            request=request,
            run=run,
            agents=agents_list,
            routing=routing_decision,
            output=output,
            usage=usage,
            messages=messages,
            events=events_list,
            mcp=mcp_info,
            policy=policy,
        )

        # Return serialized error response
        response_dict = final_response.model_dump()
        return response_dict


def _coerce_tool_args(args: Any) -> dict[str, Any]:
    from typing import cast

    if args is None:
        return {}
    if isinstance(args, dict):
        return cast(dict[str, Any], args)
    if isinstance(args, str):
        try:
            parsed = json.loads(args)
            return cast(dict[str, Any], parsed) if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _extract_model_metadata(
    result: AgentRunResult[Any],
) -> tuple[str | None, str | None]:
    history = getattr(result, "_state", None)
    if history is None:
        return None, None
    messages = getattr(history, "message_history", [])
    for message in reversed(messages):
        model_name = getattr(message, "model_name", None)
        provider_name = getattr(message, "provider_name", None)
        if model_name or provider_name:
            return model_name, provider_name
    return None, None


def _agent_config_from_result(
    agent_name: str, result: AgentRunResult[Any], default_config: AgentConfig | None
) -> AgentConfig:
    model_name, provider_name = _extract_model_metadata(result)
    if default_config is not None:
        config = default_config.model_copy(deep=True)
    else:
        inferred_role = "supervisor" if agent_name == "supervisor" else "sub_agent_tool"
        config = AgentConfig(
            name=agent_name,
            role=inferred_role,
            model=ModelConfig(
                provider=provider_name or "unknown", name=model_name or "unknown"
            ),
            model_settings=ModelSettings(temperature=0.0, max_tokens=0, top_p=1.0),
        )

    if model_name or provider_name:
        model_update: dict[str, Any] = {}
        if model_name:
            model_update["name"] = model_name
        if provider_name:
            model_update["provider"] = provider_name
        config = config.model_copy(
            update={"model": config.model.model_copy(update=model_update)}
        )

    return config


def _build_agents_from_tracker(event_tracker: EventTracker) -> list[AgentConfig]:
    if not event_tracker.agent_results:
        # Fallback to default configs
        return [cfg.model_copy(deep=True) for cfg in DEFAULT_AGENT_CONFIGS.values()]

    agents: list[AgentConfig] = []
    for name, result in event_tracker.agent_results.items():
        default_cfg = DEFAULT_AGENT_CONFIGS.get(name)
        agents.append(_agent_config_from_result(name, result, default_cfg))

    # Ensure deterministic ordering: supervisor first, then alphabetically
    agents.sort(key=lambda cfg: (0 if cfg.name == "supervisor" else 1, cfg.name))
    return agents


def _routing_candidates_from_result(
    result: AgentRunResult[Any] | None,
) -> tuple[str, float, list[RoutingCandidate]]:
    if result is None:
        candidate = create_routing_candidate(
            type="agent", target="supervisor", score=1.0, eligible=True
        )
        return "supervisor", 1.0, [candidate]

    messages: list[Any] = getattr(result._state, "message_history", [])  # type: ignore[attr-defined]
    candidates: list[Any] = []
    seen: set[str] = set()

    for message in messages:
        parts: list[Any] = getattr(message, "parts", [])
        for part in parts:
            if isinstance(part, ToolCallPart):
                tool_name = part.tool_name or "unknown"
                target = TOOL_TO_AGENT.get(tool_name, tool_name)
                if target in seen:
                    continue
                args_payload = _coerce_tool_args(getattr(part, "args", {}))
                score_raw = args_payload.get("score", args_payload.get("confidence"))
                try:
                    score_value = float(score_raw) if score_raw is not None else 1.0
                except (TypeError, ValueError):
                    score_value = 1.0
                score_value = max(0.0, min(1.0, score_value))
                candidates.append(
                    create_routing_candidate(
                        type="agent", target=target, score=score_value, eligible=True
                    )
                )
                seen.add(target)

    if not candidates:
        candidates.append(
            create_routing_candidate(
                type="agent", target="supervisor", score=1.0, eligible=True
            )
        )

    selected = candidates[0].target
    confidence = float(candidates[0].score)
    return selected, confidence, candidates


def _build_routing_decision(
    user_message: str, tracker: EventTracker, events: list[EventRecord]
) -> RoutingDecision:
    supervisor_result = tracker.get_agent_result("supervisor")
    if supervisor_result is not None or tracker.agent_results:
        selected, confidence, candidates = _routing_candidates_from_result(
            supervisor_result
        )
        return build_routing_decision(
            user_message=user_message,
            selected_agent=selected,
            confidence=confidence,
            strategy="prompt_router",
            candidates=candidates,
        )
    return _build_routing_from_events(user_message, events)


def _build_routing_from_events(
    user_message: str, events: list[EventRecord]
) -> RoutingDecision:
    """Construct routing decision based on observed tool usage."""
    tool_candidates: list[dict[str, Any]] = []
    seen_targets: set[str] = set()

    for event in events:
        if event.type == EventType.TOOL_CALL_COMPLETED and isinstance(
            event.data, ToolCallCompletedData
        ):
            target = event.data.tool_name or event.source.get("agent", "supervisor")
            if target not in seen_targets:
                tool_candidates.append(
                    {"type": "tool", "target": target, "score": 1.0, "eligible": True}
                )
                seen_targets.add(target)

    if tool_candidates:
        selected = tool_candidates[0]["target"]
        confidence = tool_candidates[0]["score"]
        candidates_data = tool_candidates
    else:
        selected = "supervisor"
        confidence = 1.0
        candidates_data = None

    return build_routing_decision(
        user_message=user_message,
        selected_agent=selected,
        confidence=confidence,
        strategy="prompt_router",
        candidates=candidates_data,
    )

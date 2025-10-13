"""Core response builders for basic schema components"""

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any, Literal, cast
from uuid import UUID

from ...models.response_schema import (
    AgentConfig,
    ConversationContext,
    OutputResult,
    Policy,
    RequestInfo,
    RoutingCandidate,
    RoutingDecision,
    RoutingSelection,
    RunInfo,
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
    user_message: str,
    requested_by: Literal["user", "system", "automation"] | None = "user",
    timestamp: datetime | None = None,
) -> RequestInfo:
    """Build request info with trigger source"""
    if timestamp is None:
        timestamp = datetime.now(UTC)

    return RequestInfo(
        timestamp=timestamp, user_message=user_message, requested_by=requested_by
    )


def build_workflow_config(
    type: Literal["single_agent", "multi_agent"],
    supervisor_agent: str,
    sub_agents: list[dict[str, Any]],
) -> WorkflowConfig:
    """Build workflow configuration"""
    # Narrow to allowed literals at call sites; mypy will enforce
    return WorkflowConfig(
        type=type,  # Literal validated by Pydantic model
        supervisor_agent=supervisor_agent,
        sub_agents=sub_agents,
    )


def build_run_info(
    run_id: UUID,
    parent_run_id: UUID | None = None,
    retry_of: UUID | None = None,
    attempt: int = 1,
    status: Literal["succeeded", "failed", "cancelled", "timed_out"] = "succeeded",
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
    correlation_id: UUID | None = None,
    tags: list[str] | None = None,
    workflow: WorkflowConfig | None = None,
    **legacy_kwargs: Any,
) -> RunInfo:
    """Build run information"""
    if started_at is None and "start_time" in legacy_kwargs:
        started_at = legacy_kwargs.pop("start_time")
    if completed_at is None and "end_time" in legacy_kwargs:
        completed_at = legacy_kwargs.pop("end_time")
    if legacy_kwargs:
        raise TypeError(
            f"Unexpected keyword arguments: {', '.join(legacy_kwargs.keys())}"
        )

    if started_at is None:
        started_at = datetime.now(UTC)
    if completed_at is None:
        completed_at = datetime.now(UTC)
    if tags is None:
        tags = ["production", "v1.3"]

    return RunInfo(
        id=run_id,
        parent_run_id=parent_run_id,
        retry_of=retry_of,
        attempt=attempt,
        status=status,  # Literal validated by Pydantic model
        started_at=started_at,
        completed_at=completed_at,
        correlation_id=correlation_id,
        tags=tags,
        workflow=workflow
        or WorkflowConfig(
            type="single_agent", supervisor_agent="supervisor", sub_agents=[]
        ),
    )


def build_agent_config(
    name: str,
    role: str,
    provider: str,
    model_name: str,
    temperature: float = 0.2,
    max_tokens: int = 4000,
    top_p: float = 1.0,
    thinking_enabled: bool = False,
    thinking_budget_tokens: int = 2048,
) -> AgentConfig:
    """Build agent configuration"""
    from ...models.response_schema import ModelConfig, ModelSettings

    model_config = ModelConfig(provider=provider, name=model_name)

    model_settings = ModelSettings(
        temperature=temperature,
        max_tokens=max_tokens,
        top_p=top_p,
        thinking={"enabled": thinking_enabled, "budget_tokens": thinking_budget_tokens}
        if thinking_enabled
        else None,
    )

    return AgentConfig(
        name=name, role=role, model=model_config, model_settings=model_settings
    )


def build_routing_decision(
    user_message: str,
    selected_agent: str,
    confidence: float,
    strategy: Literal["rule_based", "prompt_router", "tool_router_llm", "hybrid"]
    | None = None,
    candidates: Sequence[object] | None = None,
) -> RoutingDecision:
    """Build routing decision with analytics"""
    routing_candidates = []
    allowed_types = {"agent", "tool", "mcp_tool"}
    if candidates:
        for candidate in candidates:
            if isinstance(candidate, Mapping):
                cand_type = str(candidate.get("type", "agent"))
                target = str(candidate.get("target", selected_agent))
                score = float(candidate.get("score", confidence))
                eligible = bool(candidate.get("eligible", True))
            elif isinstance(candidate, RoutingCandidate):
                cand_type = candidate.type
                target = candidate.target
                score = float(candidate.score)
                eligible = bool(candidate.eligible)
            else:
                cand_type = str(getattr(candidate, "type", "agent"))
                target = str(getattr(candidate, "target", selected_agent))
                score = float(getattr(candidate, "score", confidence))
                eligible = bool(getattr(candidate, "eligible", True))

            if cand_type not in allowed_types:
                cand_type = "agent"

            cand_type_literal = cast(Literal["agent", "tool", "mcp_tool"], cand_type)

            routing_candidates.append(
                create_routing_candidate(
                    type=cand_type_literal,
                    target=target,
                    score=score,
                    eligible=eligible,
                )
            )
    else:
        routing_candidates.append(
            create_routing_candidate(
                type="agent", target=selected_agent, score=confidence, eligible=True
            )
        )

    return RoutingDecision(
        decider="supervisor",
        strategy=strategy or "prompt_router",
        candidates=routing_candidates,
        selection=RoutingSelection(selected=selected_agent),
        reason=f"Selected {selected_agent} based on user message analysis",
        confidence=confidence,
    )


def build_output_result(output_type: str, output_value: str) -> OutputResult:
    """Build output result"""
    return OutputResult(type=output_type, value=output_value)


def build_policy(
    thinking_visibility: str = "full",
    pii_filter: bool = False,
    policy_version: str | None = None,
) -> "Policy":
    """Build policy configuration for compliance"""
    from ...models.response_schema import Policy

    # Validate thinking_visibility is one of the expected literals
    valid_visibilities = ["full", "hidden"]
    if thinking_visibility not in valid_visibilities:
        thinking_visibility = "full"  # Default to full for invalid visibility

    return Policy(
        thinking_visibility=thinking_visibility,  # type: ignore
        pii_filter=pii_filter,
        policy_version=policy_version,
    )

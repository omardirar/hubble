"""Supervisor agent that orchestrates specialised child agents."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pydantic_ai import Agent, RunContext
from pydantic_ai.run import AgentRunResultEvent

from ..config.settings import Settings, get_settings
from ..utils.logging import get_logger
from ..utils.streaming import StreamingRuntime
from .analyst import AnalystDeps, create_analyst_agent
from .factory import build_anthropic_model
from .marketer import MarketerDeps, create_marketer_agent

logger = get_logger(__name__)


@dataclass(slots=True)
class SupervisorDeps:
    """Per-run data required by the supervisor agent."""

    settings: Settings
    org_id: str
    user_id: str
    conversation_id: str
    run_id: str
    streaming: StreamingRuntime | None = None
    motherduck_url: str | None = None
    motherduck_token: str | None = None
    database_name: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    _analyst_agent: Agent[AnalystDeps, str] | None = field(default=None, init=False, repr=False)
    _marketer_agent: Agent[MarketerDeps, str] | None = field(default=None, init=False, repr=False)

    def analyst_agent(self) -> Agent[AnalystDeps, str]:
        if self._analyst_agent is None:
            self._analyst_agent = create_analyst_agent(self.settings)
        return self._analyst_agent

    def marketer_agent(self) -> Agent[MarketerDeps, str]:
        if self._marketer_agent is None:
            self._marketer_agent = create_marketer_agent(self.settings)
        return self._marketer_agent

    @property
    def resolved_motherduck_url(self) -> str | None:
        return self.motherduck_url or self.settings.mcp.motherduck_url

    @property
    def resolved_motherduck_token(self) -> str | None:
        if self.motherduck_token:
            return self.motherduck_token
        token = self.settings.mcp.motherduck_token
        return token.get_secret_value() if token else None

    @property
    def resolved_database_name(self) -> str | None:
        return self.database_name or self.settings.mcp.database_name


async def analyze_data(ctx: RunContext[SupervisorDeps], query: str) -> str:
    """Delegate a data question to the analyst agent."""

    deps = ctx.deps
    analyst_deps = AnalystDeps(
        motherduck_url=deps.resolved_motherduck_url,
        motherduck_token=deps.resolved_motherduck_token,
        database_name=deps.resolved_database_name,
    )

    runtime = deps.streaming
    if runtime is None:
        analyst_result = await deps.analyst_agent().run(query, deps=analyst_deps)
        return analyst_result.output

    child_source = runtime.new_source(
        agent=deps.analyst_agent().name or "analyst",
        parent_run_id=deps.run_id,
        tool_name=ctx.tool_name,
        tool_call_id=ctx.tool_call_id,
    )

    result_event: AgentRunResultEvent[str] = await runtime.stream_agent(
        child_source,
        deps.analyst_agent().run_stream_events(
            query,
            deps=analyst_deps,
            usage=ctx.usage,
        ),
    )
    return result_event.result.output


async def provide_marketing_guidance(ctx: RunContext[SupervisorDeps], topic: str) -> str:
    """Delegate marketing queries to the marketer agent."""

    deps = ctx.deps
    marketer_deps = MarketerDeps()

    runtime = deps.streaming
    if runtime is None:
        marketer_result = await deps.marketer_agent().run(topic, deps=marketer_deps)
        return marketer_result.output

    child_source = runtime.new_source(
        agent=deps.marketer_agent().name or "marketer",
        parent_run_id=deps.run_id,
        tool_name=ctx.tool_name,
        tool_call_id=ctx.tool_call_id,
    )

    result_event: AgentRunResultEvent[str] = await runtime.stream_agent(
        child_source,
        deps.marketer_agent().run_stream_events(
            topic,
            deps=marketer_deps,
            usage=ctx.usage,
        ),
    )
    return result_event.result.output


def create_supervisor_agent(settings: Settings | None = None) -> Agent[SupervisorDeps, str]:
    """Instantiate the supervisor agent."""

    settings = settings or get_settings()
    model, model_settings = build_anthropic_model(
        settings.supervisor, settings.anthropic_api_key.get_secret_value()
    )

    return Agent(
        model=model,
        model_settings=model_settings,
        name="supervisor",
        deps_type=SupervisorDeps,
        output_type=str,
        system_prompt=_SUPERVISOR_PROMPT,
        tools=[analyze_data, provide_marketing_guidance],
    )


_SUPERVISOR_PROMPT = """\
You are the supervisor responsible for producing the final response to the user.

Available tools:
- analyze_data(query: str): use when the user needs data analysis or SQL execution.
- provide_marketing_guidance(topic: str): use for go-to-market, positioning, or marketing support.

General workflow:
1. Clarify the user's request.
2. Decide whether a tool should be called. Use the analyst for anything involving data or SQL.
3. Summarise tool outputs plainly. Highlight assumptions or missing data.
4. Provide clear next steps or recommendations when helpful.

Always communicate in a confident but friendly tone.  If you cannot complete
the request due to missing configuration, explain what additional information
is required.
"""

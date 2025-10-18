"""Analyst agent responsible for answering data questions via MCP."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from pydantic_ai import Agent, RunContext

from ..config.settings import Settings, get_settings
from ..mcp_client import call_mcp_tool
from ..utils.logging import get_logger
from .factory import build_anthropic_model

logger = get_logger(__name__)

DEFAULT_SQL_TOOL_NAME = "sql.query"


@dataclass(slots=True)
class AnalystDeps:
    """Dependency container injected into the analyst agent at runtime."""

    motherduck_url: str | None
    motherduck_token: str | None
    database_name: str | None
    sql_tool_name: str = DEFAULT_SQL_TOOL_NAME
    timeout_seconds: float = 30.0

    def token_value(self) -> str | None:
        return self.motherduck_token


async def run_sql(ctx: RunContext[AnalystDeps], sql: str) -> str:
    """Execute a SQL statement through the configured MCP server."""

    deps = ctx.deps
    if not deps.motherduck_url:
        raise RuntimeError("motherduck_url is not configured for the analyst agent")

    logger.debug(
        "Executing SQL via MCP",
        extra={
            "sql_preview": sql[:200],
            "server": deps.motherduck_url,
            "tool": deps.sql_tool_name,
            "database": deps.database_name,
        },
    )

    tool_result = await call_mcp_tool(
        url=deps.motherduck_url,
        tool_name=deps.sql_tool_name,
        arguments={"sql": sql},
        token=deps.token_value(),
        database=deps.database_name,
        timeout=deps.timeout_seconds,
    )

    return _format_mcp_tool_result(tool_result)


def create_analyst_agent(settings: Settings | None = None) -> Agent[AnalystDeps, str]:
    """Instantiate the analyst agent."""

    settings = settings or get_settings()
    model, model_settings = build_anthropic_model(
        settings.analyst, settings.anthropic_api_key.get_secret_value()
    )

    return Agent(
        model=model,
        model_settings=model_settings,
        name="analyst",
        deps_type=AnalystDeps,
        output_type=str,
        system_prompt=(
            "You are a data analyst. Answer the question by generating concise SQL that can be "
            "executed against a DuckDB database via MCP. Return a friendly explanation of the "
            "result along with any caveats."
        ),
        tools=[run_sql],
    )


def _format_mcp_tool_result(result: Any) -> str:
    """Convert an MCP tool result into a displayable string."""

    if result is None:
        return "No results returned."

    # Many MCP responses expose a `.content` list mirroring the protocol spec.
    content = getattr(result, "content", None)
    if content:
        text_fragments: list[str] = []
        for item in content:
            text = getattr(item, "text", None)
            if text:
                text_fragments.append(text)
                continue
            value = getattr(item, "value", None)
            if value is not None:
                text_fragments.append(str(value))
                continue
            if hasattr(item, "model_dump"):
                try:
                    text_fragments.append(json.dumps(item.model_dump(), default=str))
                    continue
                except Exception:  # pragma: no cover - defensive
                    pass
            text_fragments.append(repr(item))

        if text_fragments:
            return "\n".join(text_fragments)

    if hasattr(result, "model_dump"):
        try:
            return json.dumps(result.model_dump(), default=str)
        except Exception:  # pragma: no cover - defensive
            return repr(result)

    return repr(result)

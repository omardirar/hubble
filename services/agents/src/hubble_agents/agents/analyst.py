"""Analyst agent for data analysis and SQL queries"""

import os

from pydantic import BaseModel
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.anthropic import AnthropicModel, AnthropicModelSettings
from pydantic_ai.providers.anthropic import AnthropicProvider

from ..models import EventType
from ..models.event_tracker import EventTracker
from ..models.response_schema import (
    AgentRunCompletedData,
    AgentRunStartedData,
    create_error_info,
    create_failed_event_data,
)
from ..utils.logging import get_logger
from ..utils.response_builder import build_agent_config

# Agent configuration constant for v1.3+ schema
ANALYST_CONFIG = build_agent_config(
    name="analyst_agent",
    role="sub_agent_tool",
    provider="anthropic",
    model_name="claude-sonnet-4-20250514",
    temperature=0.2,
    max_tokens=20000,
    top_p=1.0,
    thinking_enabled=True,
    thinking_budget_tokens=8000,
)

logger = get_logger(__name__)


class QueryResult(BaseModel):
    sql: str
    results: str
    explanation: str
    rows_affected: int = 0


async def execute_query(ctx: RunContext[EventTracker], sql: str) -> str:
    """Execute SQL query via MCP server with event tracking"""
    query_event_id: str | None = None
    try:
        # Log query start
        query_event_id = ctx.deps.add_event(
            event_type=EventType.AGENT_RUN_STARTED,
            agent="analyst_agent",
            content=f"Starting SQL query execution: {sql[:100]}...",
            metadata=AgentRunStartedData(),
        )

        logger.info("Executing query", extra={"sql": sql})

        # Note: This would need to be updated to work with EventTracker
        # For now, we'll simulate the query execution
        result = f"Query executed successfully: {sql}"

        # Log query completion
        ctx.deps.add_event(
            event_type=EventType.AGENT_RUN_COMPLETED,
            agent="analyst_agent",
            content="SQL query completed successfully",
            metadata=AgentRunCompletedData(),
            parent_event_id=query_event_id,
        )

        return result

    except Exception as e:
        # Log query error
        error_info = create_error_info(code=type(e).__name__, message=str(e))
        ctx.deps.add_event(
            event_type=EventType.AGENT_RUN_FAILED,
            agent="analyst_agent",
            content=f"SQL query failed: {e!s}",
            metadata=create_failed_event_data(error_info),
            parent_event_id=query_event_id,
        )

        logger.error("Query execution failed", extra={"error": str(e), "sql": sql})
        return f"Error: {e!s}"


def get_analyst_agent() -> Agent[EventTracker, str]:
    """Get analyst agent with runtime model initialization"""
    # Create model with extended thinking at runtime
    model = AnthropicModel(
        "claude-sonnet-4-20250514",
        provider=AnthropicProvider(api_key=os.getenv("ANTHROPIC_API_KEY")),
    )
    settings = AnthropicModelSettings(
        anthropic_thinking={"type": "enabled", "budget_tokens": 4096},
        max_tokens=8192,  # Must be greater than thinking budget
    )

    agent = Agent(
        model=model,
        model_settings=settings,
        name="analyst_agent",
        deps_type=EventTracker,
        system_prompt="""You are a data analyst expert for MotherDuck/DuckDB.

**Your capabilities:**
- Generate efficient DuckDB SQL queries
- Execute queries via MCP protocol
- Format and explain results clearly
- Handle errors gracefully
- Provide business insights from data

**Guidelines:**
- Use proper DuckDB syntax
- Optimize queries for performance
- Explain results in business terms
- Include row counts and metadata
- Focus on actionable insights

**Response style:**
- Data-driven and analytical
- Clear explanations of findings
- Business context for technical results
- Specific recommendations based on data""",
        tools=[execute_query],
    )
    return agent


# Create the agent function reference for lazy loading
analyst_agent = get_analyst_agent


async def track_agent_completion(ctx: RunContext[EventTracker], output: str) -> str:
    """Track agent completion with event logging"""
    return output

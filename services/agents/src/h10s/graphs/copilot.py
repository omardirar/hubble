"""Marketing copilot LangGraph with supervisor-specialist pattern."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from functools import partial
from typing import Any

from langchain_core.messages import ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import BaseTool
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from h10s.config import AppSettings, get_settings, validate_environment
from h10s.graphs.mcp_tools import create_motherduck_tools
from h10s.graphs.nodes import (
    media_buyer_node,
    performance_analyst_node,
    planner_node,
    route_from_supervisor,
    seo_specialist_node,
    supervisor_node,
)
from h10s.graphs.state import CopilotState

logger = logging.getLogger(__name__)

# Initialize settings at module import time (before async context)
# This prevents BlockingError when LangGraph calls the agent factory in ASGI context
try:
    validate_environment()
    _SETTINGS = get_settings()
    logger.info("Settings loaded successfully model=%s", _SETTINGS.llm_model)
except Exception as e:
    logger.error("Failed to load settings: %s", e)
    raise


def _load_mcp_tools(
    settings: AppSettings, headers_override: Mapping[str, str] | None = None
) -> list[BaseTool]:
    """Synchronously load MCP tools for the current invocation."""

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(
        create_motherduck_tools(settings, headers_override=headers_override)
    )


def agent(config: RunnableConfig) -> Any:
    """Build and return compiled marketing copilot graph.

    This factory function is called by the LangGraph CLI to load the graph.
    It creates a supervisor-specialist architecture with 4 marketing specialists:
    - Performance Analyst: Metrics and campaign performance (with database tools)
    - SEO Specialist: Organic search optimization
    - Planner: Strategic marketing planning
    - Media Buyer: Paid advertising strategy

    The supervisor coordinates the specialists, delegating tasks and synthesizing
    their responses into comprehensive marketing advice.

    Args:
        config: Runtime configuration from LangGraph (currently unused)

    Returns:
        Compiled LangGraph ready for execution
    """
    # Use pre-initialized settings (loaded at module import time)
    settings = _SETTINGS

    config_mapping: Mapping[str, Any] = config if isinstance(config, Mapping) else {}

    configurable = config_mapping.get("configurable", {}) or {}
    if not isinstance(configurable, Mapping):
        logger.warning(
            "configurable payload expected Mapping[str, Any], got %s",
            type(configurable).__name__,
        )
        configurable = {}

    headers_override = configurable.get("motherduck_headers") or configurable.get(
        "mcp_motherduck_headers"
    )

    if headers_override is not None and not isinstance(headers_override, Mapping):
        logger.warning(
            "motherduck_headers config expected Mapping[str, str], got %s",
            type(headers_override).__name__,
        )
        headers_override = None

    try:
        mcp_tools = _load_mcp_tools(settings, headers_override=headers_override)
        logger.info("MCP tools initialized for run: %d tool(s) loaded", len(mcp_tools))
    except Exception as e:
        logger.warning("Failed to initialize MCP tools for run: %s", e)
        mcp_tools = []

    logger.debug(
        "Building marketing copilot graph model=%s tools=%d",
        settings.llm_model,
        len(mcp_tools),
    )

    # Define local routing function for performance analyst tool calls
    def should_use_tools_pa(state: CopilotState) -> str:
        """Route performance analyst to tools or back to supervisor."""
        last_message = state["messages"][-1]

        # Check if message has tool calls
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            logger.debug("Routing to tools node tool_count=%d", len(last_message.tool_calls))
            return "tools"

        logger.debug("Routing back to supervisor - no tools needed")
        return "supervisor"

    def route_tools_result(state: CopilotState) -> str:
        """Return tool outputs to the analyst until they hand control back."""
        messages = state["messages"]
        recent_tool_messages: list[ToolMessage] = []

        # Collect trailing tool messages from the conversation history
        for message in reversed(messages):
            if isinstance(message, ToolMessage):
                recent_tool_messages.append(message)
            else:
                break

        if not recent_tool_messages:
            logger.debug(
                "Tool node produced no ToolMessages; returning control to performance analyst"
            )
            return "performance_analyst"

        if any(getattr(message, "status", None) == "error" for message in recent_tool_messages):
            logger.debug("Tool call reported failure; giving analyst another turn to repair")
        else:
            logger.debug(
                "Tool call succeeded; giving analyst a chance to interpret before supervisor"
            )

        return "performance_analyst"

    # Create graph with CopilotState
    graph = StateGraph(CopilotState)

    # Add supervisor node
    graph.add_node("supervisor", partial(supervisor_node, settings=settings))

    # Add specialist nodes (performance analyst gets tools)
    graph.add_node(
        "performance_analyst",
        partial(
            performance_analyst_node,
            settings=settings,
            tools=mcp_tools if mcp_tools else None,
        ),
    )
    graph.add_node(
        "seo_specialist",
        partial(seo_specialist_node, settings=settings),
    )
    graph.add_node(
        "planner",
        partial(planner_node, settings=settings),
    )
    graph.add_node(
        "media_buyer",
        partial(media_buyer_node, settings=settings),
    )

    # Add ToolNode if MCP tools are available
    if mcp_tools:
        graph.add_node("tools", ToolNode(mcp_tools))

    # Define edges and routing
    graph.add_edge(START, "supervisor")

    # Supervisor decides which specialist to delegate to, or ends
    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {
            "performance_analyst": "performance_analyst",
            "seo_specialist": "seo_specialist",
            "planner": "planner",
            "media_buyer": "media_buyer",
            "__end__": END,
        },
    )

    # Performance analyst can call tools or return to supervisor
    if mcp_tools:
        graph.add_conditional_edges(
            "performance_analyst",
            should_use_tools_pa,
            {
                "tools": "tools",
                "supervisor": "supervisor",
            },
        )
        # Tools always return to the performance analyst so they can interpret
        # results (and optionally request more tool calls) before handing back
        # to the supervisor.
        graph.add_conditional_edges(
            "tools",
            route_tools_result,
            {
                "performance_analyst": "performance_analyst",
            },
        )
    else:
        # No tools - go straight back to supervisor
        graph.add_edge("performance_analyst", "supervisor")

    # Other specialists return to supervisor for coordination
    graph.add_edge("seo_specialist", "supervisor")
    graph.add_edge("planner", "supervisor")
    graph.add_edge("media_buyer", "supervisor")

    # Compile and return
    compiled = graph.compile()
    logger.debug(
        "Marketing copilot graph compiled: 4 specialists, %d tool(s)",
        len(mcp_tools),
    )

    return compiled


__all__ = ["agent"]

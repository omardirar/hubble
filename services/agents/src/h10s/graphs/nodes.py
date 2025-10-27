"""Node functions and routing logic for marketing copilot graph."""

from __future__ import annotations

import logging
from typing import Any, Literal

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool

from h10s.config import AppSettings
from h10s.graphs.state import CopilotState

logger = logging.getLogger(__name__)


def _parse_ascii_table_rows(table_text: str) -> list[list[str]]:
    """Parse ASCII table output from tools into row lists."""
    rows: list[list[str]] = []
    for line in table_text.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        parts = [part.strip() for part in line.strip("|").split("|")]
        if not any(parts):
            continue
        rows.append(parts)
    return rows


def _extract_table_identifier(sql: str) -> str | None:
    sql_clean = sql.strip().rstrip(";")
    if not sql_clean:
        return None
    tokens = sql_clean.split()
    if not tokens:
        return None
    keyword = tokens[0].upper()
    if keyword == "DESCRIBE" and len(tokens) > 1:
        return tokens[1]
    return None


def _update_analysis_cache_from_tool(cache: dict[str, Any], messages: list[Any]) -> dict[str, Any]:
    """Update analysis cache using the most recent tool message."""

    if not messages or not isinstance(messages[-1], ToolMessage):
        return cache

    tool_msg = messages[-1]
    tool_call_id = getattr(tool_msg, "tool_call_id", None)
    if not tool_call_id:
        return cache

    processed_ids = set(cache.get("processed_tool_ids", []))
    if tool_call_id in processed_ids:
        return cache

    query_text: str | None = None
    tool_name = getattr(tool_msg, "name", "")
    for message in reversed(messages[:-1]):
        if isinstance(message, AIMessage):
            for call in getattr(message, "tool_calls", []):
                call_id = call.get("id") if isinstance(call, dict) else getattr(call, "id", None)
                if call_id != tool_call_id:
                    continue
                call_args = (
                    call.get("args") if isinstance(call, dict) else getattr(call, "args", {})
                )
                if isinstance(call_args, dict):
                    raw_query = call_args.get("query")
                    if isinstance(raw_query, str):
                        query_text = raw_query
                break
        if query_text:
            break

    processed_ids.add(tool_call_id)
    cache["processed_tool_ids"] = list(processed_ids)

    if not query_text:
        return cache

    query_lower = query_text.lower()

    if getattr(tool_msg, "status", "") == "error":
        cache["last_error"] = {
            "query": query_text.strip(),
            "message": str(tool_msg.content).strip(),
            "tool_name": tool_name,
        }
        return cache

    # Successful response - parse and cache useful metadata
    content = tool_msg.content if isinstance(tool_msg.content, str) else ""
    rows = _parse_ascii_table_rows(content)
    if not rows:
        return cache

    if "information_schema.tables" in query_lower:
        header = rows[0]
        if not header:
            return cache
        lower_header = [col.lower() for col in header]
        try:
            schema_idx = lower_header.index("table_schema")
            name_idx = lower_header.index("table_name")
        except ValueError:
            return cache

        data_rows = [row for row in rows[2:] if len(row) > max(schema_idx, name_idx)]
        table_inventory = cache.setdefault("table_inventory", {})
        for data in data_rows:
            schema = data[schema_idx]
            table = data[name_idx]
            if not schema or not table:
                continue
            if schema not in table_inventory:
                table_inventory[schema] = []
            if table not in table_inventory[schema]:
                table_inventory[schema].append(table)
        return cache

    if query_lower.startswith("show tables"):
        # MotherDuck SHOW TABLES returns a single column named "name"
        header = rows[0]
        lower_header = [col.lower() for col in header]
        try:
            name_idx = lower_header.index("name")
        except ValueError:
            return cache
        tables = [row[name_idx] for row in rows[2:] if len(row) > name_idx]
        if tables:
            table_inventory = cache.setdefault("table_inventory", {})
            default_schema = cache.setdefault("default_schema", "public")
            table_inventory.setdefault(default_schema, [])
            for table in tables:
                if table and table not in table_inventory[default_schema]:
                    table_inventory[default_schema].append(table)
        return cache

    table_identifier = _extract_table_identifier(query_text)
    if table_identifier:
        header = rows[0]
        lower_header = [col.lower() for col in header]
        try:
            column_idx = lower_header.index("column_name")
        except ValueError:
            return cache
        data_rows = [row for row in rows[2:] if len(row) > column_idx]
        columns = [row[column_idx] for row in data_rows if row[column_idx]]
        table_schemas = cache.setdefault("table_schemas", {})
        table_schemas[table_identifier] = columns
        return cache

    return cache


def _format_analysis_context(cache: dict[str, Any]) -> str:
    """Format cached analysis data for injection into prompts."""

    lines: list[str] = []

    table_inventory = cache.get("table_inventory", {})
    for schema, tables in table_inventory.items():
        if not tables:
            continue
        preview = ", ".join(tables[:10])
        if len(tables) > 10:
            preview += ", …"
        lines.append(f"Tables in {schema}: {preview}")

    table_schemas = cache.get("table_schemas", {})
    for table, columns in table_schemas.items():
        if not columns:
            continue
        preview = ", ".join(columns[:12])
        if len(columns) > 12:
            preview += ", …"
        lines.append(f"Columns recorded for {table}: {preview}")

    last_error = cache.get("last_error")
    if isinstance(last_error, dict):
        query = last_error.get("query", "")
        message = last_error.get("message", "")
        if query or message:
            lines.append(f"Last tool error on `{query}`: {message}")

    return "\n".join(lines)


async def supervisor_node(state: CopilotState, settings: AppSettings) -> dict[str, Any]:
    """Coordinate workflow and delegate to marketing specialists.

    The supervisor analyzes the user's marketing query, decides which specialist(s)
    to consult, synthesizes their responses, and determines when the task is complete.

    Args:
        state: Current graph state with messages and routing info
        settings: Application settings for LLM configuration

    Returns:
        Dictionary with updated messages and routing information
    """
    llm = ChatAnthropic(  # type: ignore[call-arg]
        model=settings.llm_model,
        temperature=0.3,
        streaming=True,
        anthropic_api_key=settings.anthropic_api_key.get_secret_value(),
    )

    system_prompt = SystemMessage(
        content="""You are a marketing strategy supervisor coordinating a team of specialists.

Your team of marketing experts:
- **Performance Analyst**: Analyzes campaign metrics, KPIs, conversion data, and ROI.
  Identifies performance trends and optimization opportunities.
- **SEO Specialist**: Handles organic search optimization, keyword research, content
  strategy, and technical SEO guidance.
- **Planner**: Develops strategic marketing plans, campaign timelines, multi-channel
  strategies, and budget allocation.
- **Media Buyer**: Manages paid advertising strategy, channel selection (Google, Meta,
  etc.), budget optimization, and audience targeting.

Your responsibilities:
1. Understand the user's marketing question or goal
2. Decide which specialist can best help (you can consult multiple specialists sequentially)
3. Delegate by responding with which specialist to consult next
4. Synthesize specialist responses into comprehensive, actionable advice
5. Determine when you have enough information to provide a complete answer

Decision-making:
- If you need a specialist's input: Clearly state which specialist you're delegating to and why
- If you have enough information: Provide your final comprehensive answer to the user
- You can consult multiple specialists in sequence for complex questions

When delegating, your message should clearly indicate which specialist you're calling
on and what specific question or task you need them to address."""
    )

    messages = [system_prompt] + state["messages"]
    response = await llm.ainvoke(messages)

    # Analyze response to determine routing
    content = response.content.lower() if isinstance(response.content, str) else ""

    next_specialist = ""
    task_complete = False

    # Check for specialist mentions (order matters - check specific ones first)
    if "performance analyst" in content or "performance_analyst" in content:
        next_specialist = "performance_analyst"
    elif "seo specialist" in content or "seo_specialist" in content:
        next_specialist = "seo_specialist"
    elif "media buyer" in content or "media_buyer" in content:
        next_specialist = "media_buyer"
    elif "planner" in content:
        next_specialist = "planner"
    else:
        # No specialist mentioned - task is complete
        task_complete = True

    logger.debug(
        "Supervisor node completed next_specialist=%s task_complete=%s",
        next_specialist,
        task_complete,
    )

    return {
        "messages": [response],
        "next_specialist": next_specialist,
        "task_complete": task_complete,
    }


async def performance_analyst_node(
    state: CopilotState,
    settings: AppSettings,
    tools: list[BaseTool] | None = None,
) -> dict[str, Any]:
    """Analyze campaign performance metrics and provide optimization recommendations.

    The performance analyst specializes in data analysis, KPI tracking, conversion
    optimization, and ROI measurement. Can query marketing databases when tools
    are provided.

    Args:
        state: Current graph state with messages
        settings: Application settings for LLM configuration
        tools: Optional list of tools (e.g., database query tools)

    Returns:
        Dictionary with specialist's analysis
    """
    analysis_cache: dict[str, Any] = dict(state.get("analysis_cache", {}))
    analysis_cache = _update_analysis_cache_from_tool(analysis_cache, state["messages"])

    llm = ChatAnthropic(  # type: ignore[call-arg]
        model=settings.llm_model,
        temperature=0.4,
        streaming=True,
        anthropic_api_key=settings.anthropic_api_key.get_secret_value(),
    )

    # Bind tools to LLM if available
    llm_with_tools: ChatAnthropic | Any = llm
    if tools:
        llm_with_tools = llm.bind_tools(tools)
        logger.debug("Performance analyst using %d tool(s)", len(tools))

    context_summary = _format_analysis_context(analysis_cache)

    process_guidelines = """Process Guidelines:
1. When a tool call fails, capture the exact SQL and error message, reason about the
fix in your response, and only issue a corrected query once you have a clear adjustment.
2. Use cached metadata instead of re-running schema discovery. Skip broad `SHOW TABLES`
or full `information_schema` scans once table lists are available.
3. Reuse stored DESCRIBE results to validate column names; avoid repeating DESCRIBE
calls for tables already cached.
4. Before each tool call, briefly outline the plan (expected table, filters, metrics)
so later turns understand the intent.
5. Every response MUST be a single JSON code block and nothing else:
```json
{
  "status": "need_more_data" | "ready_for_supervisor",
  "results": { ... key metrics or table names ... },
  "notes": ["succinct bullet points"],
  "next_action": "planned tool query or handoff"
}
```
Set `status` to `need_more_data` whenever another tool call is required and describe
the next query in `next_action`. When the data is sufficient, set `status` to
`ready_for_supervisor`, leave `next_action` as "handoff_to_supervisor", and return
control immediately without narrative analysis.
"""

    cached_context_section = f"\nKnown Metadata:\n{context_summary}\n" if context_summary else ""

    system_prompt = SystemMessage(
        content=f"""You are a Performance Analyst specializing in marketing analytics.

Your expertise:
- Campaign performance analysis and KPI tracking
- Conversion rate optimization (CRO)
- ROI and ROAS measurement
- A/B testing and experimentation
- Attribution modeling
- Funnel analysis and optimization
- Data-driven decision making

Your role:
- Query marketing data accurately and efficiently
- Surface validated metrics, anomalies, or blockers needed by the supervisor
- Avoid storytelling or final recommendations; focus on verified facts and structured outputs
- Track which tools have been used, avoid redundant calls, and highlight any data gaps

When you have access to database tools, use them to query actual campaign data
to provide data-backed facts. If tools are unavailable, report the blocker succinctly
and request guidance without offering speculative advice.

{process_guidelines}{cached_context_section}

Do not write prose, marketing copy, or recommendations. Only return the JSON block
described above; all other turns should be tool calls or brief plans leading to them."""
    )

    messages = [system_prompt] + state["messages"]
    response = await llm_with_tools.ainvoke(messages)

    logger.debug("Performance analyst node completed message_length=%d", len(response.content))
    return {"messages": [response], "analysis_cache": analysis_cache}


async def seo_specialist_node(state: CopilotState, settings: AppSettings) -> dict[str, Any]:
    """Provide SEO strategy and organic search optimization guidance.

    The SEO specialist handles keyword research, content optimization, technical SEO,
    and organic growth strategies.

    Args:
        state: Current graph state with messages
        settings: Application settings for LLM configuration

    Returns:
        Dictionary with SEO recommendations
    """
    llm = ChatAnthropic(  # type: ignore[call-arg]
        model=settings.llm_model,
        temperature=0.4,
        streaming=True,
        anthropic_api_key=settings.anthropic_api_key.get_secret_value(),
    )

    system_prompt = SystemMessage(
        content="""You are an SEO Specialist focused on organic search optimization.

Your expertise:
- Keyword research and search intent analysis
- On-page SEO optimization
- Technical SEO (site speed, crawlability, indexing)
- Content strategy for organic growth
- Link building and authority development
- Local SEO and Google Business Profile optimization
- SEO competitor analysis

Your role:
- Provide keyword and content recommendations
- Identify technical SEO issues and solutions
- Suggest organic growth strategies
- Explain ranking factors and best practices
- Balance SEO with user experience

Respond with your SEO analysis and recommendations, then return control to the supervisor."""
    )

    messages = [system_prompt] + state["messages"]
    response = await llm.ainvoke(messages)

    logger.debug("SEO specialist node completed message_length=%d", len(response.content))
    return {"messages": [response]}


async def planner_node(state: CopilotState, settings: AppSettings) -> dict[str, Any]:
    """Develop strategic marketing plans and coordinate multi-channel campaigns.

    The planner creates comprehensive marketing strategies, timelines, and
    coordinates efforts across channels.

    Args:
        state: Current graph state with messages
        settings: Application settings for LLM configuration

    Returns:
        Dictionary with strategic plan
    """
    llm = ChatAnthropic(  # type: ignore[call-arg]
        model=settings.llm_model,
        temperature=0.4,
        streaming=True,
        anthropic_api_key=settings.anthropic_api_key.get_secret_value(),
    )

    system_prompt = SystemMessage(
        content="""You are a Marketing Planner specializing in strategic campaign development.

Your expertise:
- Strategic marketing planning and goal setting
- Campaign timeline and milestone development
- Multi-channel marketing coordination
- Budget allocation and resource planning
- Market research and competitive analysis
- Customer journey mapping
- Marketing mix optimization (Product, Price, Place, Promotion)

Your role:
- Develop comprehensive marketing strategies
- Create actionable campaign plans with timelines
- Coordinate efforts across channels and teams
- Recommend budget allocation
- Identify key milestones and success metrics
- Consider short-term tactics and long-term brand building

Respond with your strategic plan and recommendations, then return control to the supervisor."""
    )

    messages = [system_prompt] + state["messages"]
    response = await llm.ainvoke(messages)

    logger.debug("Planner node completed message_length=%d", len(response.content))
    return {"messages": [response]}


async def media_buyer_node(state: CopilotState, settings: AppSettings) -> dict[str, Any]:
    """Provide paid advertising strategy and media buying recommendations.

    The media buyer specializes in paid channels, budget optimization, and
    audience targeting across platforms.

    Args:
        state: Current graph state with messages
        settings: Application settings for LLM configuration

    Returns:
        Dictionary with media buying recommendations
    """
    llm = ChatAnthropic(  # type: ignore[call-arg]
        model=settings.llm_model,
        temperature=0.4,
        streaming=True,
        anthropic_api_key=settings.anthropic_api_key.get_secret_value(),
    )

    system_prompt = SystemMessage(
        content="""You are a Media Buyer specializing in paid advertising strategy.

Your expertise:
- Paid search (Google Ads, Bing Ads)
- Paid social (Meta, LinkedIn, TikTok, Twitter/X)
- Display and programmatic advertising
- Budget optimization and bidding strategies
- Audience targeting and segmentation
- Ad creative strategy and testing
- Campaign structure and account organization

Your role:
- Recommend optimal paid channels for goals and audience
- Suggest budget allocation across platforms
- Provide targeting and audience recommendations
- Advise on bidding strategies and optimization
- Recommend ad creative approaches and testing plans
- Identify opportunities for efficiency and scale

Respond with your media buying recommendations, then return control to the supervisor."""
    )

    messages = [system_prompt] + state["messages"]
    response = await llm.ainvoke(messages)

    logger.debug("Media buyer node completed message_length=%d", len(response.content))
    return {"messages": [response]}


def route_from_supervisor(
    state: CopilotState,
) -> Literal["performance_analyst", "seo_specialist", "planner", "media_buyer", "__end__"]:
    """Route from supervisor to the appropriate specialist or end.

    Examines the state to determine the next destination based on the supervisor's
    delegation decision.

    Args:
        state: Current graph state with routing information

    Returns:
        Name of the next specialist node or "__end__" if task is complete
    """
    if state.get("task_complete", False):
        logger.debug("Routing to END - task complete")
        return "__end__"

    next_specialist = state.get("next_specialist", "")

    if next_specialist == "performance_analyst":
        logger.debug("Routing to performance analyst")
        return "performance_analyst"
    elif next_specialist == "seo_specialist":
        logger.debug("Routing to SEO specialist")
        return "seo_specialist"
    elif next_specialist == "planner":
        logger.debug("Routing to planner")
        return "planner"
    elif next_specialist == "media_buyer":
        logger.debug("Routing to media buyer")
        return "media_buyer"
    else:
        # Default to end if no specialist specified
        logger.debug("Routing to END - no specialist specified")
        return "__end__"


__all__ = [
    "media_buyer_node",
    "performance_analyst_node",
    "planner_node",
    "route_from_supervisor",
    "seo_specialist_node",
    "supervisor_node",
]

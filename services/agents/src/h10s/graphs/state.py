"""State schemas for LangGraph agents."""

from __future__ import annotations

from typing import Any, NotRequired

from langgraph.graph import MessagesState


class CopilotState(MessagesState):
    """State for multi-specialist marketing copilot.

    This state extends MessagesState to track conversation history and routing
    information for the supervisor-specialist coordination pattern.

    Attributes:
        messages: List of messages in the conversation (from MessagesState)
        next_specialist: Which specialist the supervisor wants to delegate to next.
            Valid values: "performance_analyst", "seo_specialist", "planner", "media_buyer", or ""
        task_complete: Whether the supervisor considers the task finished
        analysis_cache: Optional structured context (table metadata, recent errors, etc.)
            collected by the performance analyst to avoid redundant tool calls
    """

    next_specialist: str
    task_complete: bool
    analysis_cache: NotRequired[dict[str, Any]]


__all__ = ["CopilotState"]

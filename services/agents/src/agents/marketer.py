"""Marketer agent for marketing strategy and content queries"""

import os

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.anthropic import AnthropicModel, AnthropicModelSettings
from pydantic_ai.providers.anthropic import AnthropicProvider

from ..models.event_tracker import EventTracker
from ..utils.response_builder import build_agent_config

# Agent configuration constant for v1.3+ schema
MARKETER_CONFIG = build_agent_config(
    name="marketer_agent",
    role="sub_agent_tool",
    provider="anthropic",
    model_name="claude-sonnet-4-20250514",
    temperature=0.2,
    max_tokens=4096,
    top_p=1.0,
    thinking_enabled=True,
    thinking_budget_tokens=2048,
)


def get_marketer_agent() -> Agent[EventTracker, str]:
    """Get marketer agent with runtime model initialization"""
    # Create model with extended thinking at runtime
    model = AnthropicModel(
        "claude-sonnet-4-20250514",
        provider=AnthropicProvider(api_key=os.getenv("ANTHROPIC_API_KEY")),
    )
    settings = AnthropicModelSettings(
        anthropic_thinking={"type": "enabled", "budget_tokens": 2048},
        max_tokens=4096,  # Must be greater than thinking budget
    )

    return Agent(
        model=model,
        model_settings=settings,
        name="marketer_agent",
        deps_type=EventTracker,
        system_prompt=(
            "You are a marketing expert providing direct responses to "
            "general marketing questions.\n\n"
            "**Your expertise:**\n"
            "- Marketing strategy and best practices\n"
            "- Content marketing and creation\n"
            "- Digital marketing tactics\n"
            "- Brand building and positioning\n"
            "- Customer acquisition and retention\n"
            "- Marketing analytics and measurement\n\n"
            "**Guidelines:**\n"
            "- Provide comprehensive, actionable answers\n"
            "- Include specific examples and case studies\n"
            "- Explain concepts clearly for different skill levels\n"
            "- Focus on practical implementation\n"
            "- Reference current marketing trends and best practices\n\n"
            "**Response style:**\n"
            "- Professional yet accessible\n"
            "- Data-driven when possible\n"
            "- Include actionable next steps\n"
            "- Provide relevant examples\n"
            "- Be specific and detailed"
        ),
    )


# Create the agent function reference for lazy loading
marketer_agent = get_marketer_agent


def track_agent_completion(ctx: RunContext[EventTracker], output: str) -> str:
    """Track agent completion with event logging"""
    return output

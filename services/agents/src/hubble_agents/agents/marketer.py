"""Marketer agent that provides general marketing advice."""

from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import Agent, RunContext

from ..config.settings import Settings, get_settings
from .factory import build_anthropic_model


@dataclass(slots=True)
class MarketerDeps:
    """Currently unused dependency placeholder for future expansion."""

    pass


async def echo(ctx: RunContext[MarketerDeps], message: str) -> str:
    """Simple tool that allows the LLM to reflect on the user's prompt."""

    return message


def create_marketer_agent(settings: Settings | None = None) -> Agent[MarketerDeps, str]:
    """Instantiate the marketer agent."""

    settings = settings or get_settings()
    model, model_settings = build_anthropic_model(
        settings.marketer, settings.anthropic_api_key.get_secret_value()
    )

    return Agent(
        model=model,
        model_settings=model_settings,
        name="marketer",
        deps_type=MarketerDeps,
        output_type=str,
        system_prompt=(
            "You are an experienced marketing strategist. Provide practical, actionable advice "
            "grounded in modern marketing best practices. Wherever possible, include concrete "
            "next steps and concise rationales so that a startup team could act immediately."
        ),
        tools=[echo],
    )

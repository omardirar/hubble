"""Copilot crew implementation using CrewAI's YAML configuration."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from crewai import Agent, Crew, Task  # type: ignore[import-untyped]
from crewai.project import CrewBase, agent, crew, task  # type: ignore[import-untyped]

from h10s.config import AppSettings
from h10s.tools import ToolRegistry

logger = logging.getLogger(__name__)


@CrewBase
class CopilotCrew:
    """Growth Copilot crew with YAML-based configuration."""

    # Path to configuration files relative to this file
    # Note: @CrewBase decorator loads these YAML files at runtime and makes them
    # accessible as dicts, but type checkers don't understand decorator magic
    agents_config: Any = str(Path(__file__).parent / "config" / "agents.yml")
    tasks_config: Any = str(Path(__file__).parent / "config" / "tasks.yml")

    def __init__(self, settings: AppSettings, tools: ToolRegistry | None = None) -> None:
        self.settings = settings
        self.tools = tools or ToolRegistry()
        self._tools_list = list(self.tools.get_all())
        logger.debug(
            "Copilot crew initialised environment=%s tools=%s",
            self.settings.environment,
            len(self._tools_list),
        )

    @property
    def name(self) -> str:
        """Return the crew name."""
        return "copilot"

    @property
    def version(self) -> str:
        """Return the crew version from settings."""
        return self.settings.crew_version

    @agent  # type: ignore[misc]
    def manager(self) -> Agent:
        """Load supervisor agent from YAML configuration."""
        return Agent(
            config=self.agents_config["supervisor"],  # type: ignore[index]
            verbose=self.settings.environment == "development",
        )

    @agent  # type: ignore[misc]
    def specialist(self) -> Agent:
        """Load specialist agent from YAML configuration with tools."""
        return Agent(
            config=self.agents_config["specialist"],  # type: ignore[index]
            tools=self._tools_list,
            verbose=self.settings.environment == "development",
        )

    @task  # type: ignore[misc]
    def growth_plan(self) -> Task:
        """Load growth plan task from YAML configuration."""
        return Task(
            config=self.tasks_config["growth_plan"],  # type: ignore[index]
            agent=self.specialist(),
        )

    @crew  # type: ignore[misc]
    def crew(self) -> Crew:
        """Instantiate the CrewAI crew with configured agents and tasks."""
        # Note: self.agents and self.tasks are added by @CrewBase decorator
        return Crew(
            agents=self.agents,  # type: ignore[attr-defined]
            tasks=self.tasks,  # type: ignore[attr-defined]
            memory=True,
            verbose=self.settings.environment == "development",
        )

    def build(self, prompt: str) -> Crew:
        """Build the crew with the given user prompt.

        Args:
            prompt: User's input prompt for the task

        Returns:
            Configured Crew instance ready for execution
        """
        # Note: Prompt is passed via kickoff inputs, not environment variables
        # to avoid thread-safety issues with concurrent requests
        logger.info("Building Copilot crew for prompt length=%s", len(prompt))
        return self.crew()


__all__ = ["CopilotCrew"]

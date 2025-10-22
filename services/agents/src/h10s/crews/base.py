"""Base protocol for H10S crew implementations."""

from __future__ import annotations

from typing import Protocol

from crewai import Crew  # type: ignore[import]

from h10s.config import AppSettings
from h10s.tools import ToolRegistry


class BaseCrew(Protocol):
    """Protocol defining the interface for H10S crew implementations.

    This allows crews to use different implementation strategies (e.g., @CrewBase
    decorator with YAML configuration) while maintaining a consistent interface
    for the execution service.
    """

    settings: AppSettings
    tools: ToolRegistry

    @property
    def name(self) -> str:
        """Return the crew name."""
        ...

    @property
    def version(self) -> str:
        """Return the crew version."""
        ...

    def build(self, prompt: str) -> Crew:
        """Build and return a configured Crew instance.

        Args:
            prompt: User's input prompt for the task

        Returns:
            Configured Crew instance ready for execution
        """
        ...


__all__ = ["BaseCrew"]

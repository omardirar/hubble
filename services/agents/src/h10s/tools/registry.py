"""Registry utilities for CrewAI tool integrations."""

from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass, field

from crewai.tools import BaseTool  # type: ignore[import]

logger = logging.getLogger(__name__)


@dataclass
class ToolRegistry:
    """In-memory registry of tools available to agents."""

    tools: dict[str, BaseTool] = field(default_factory=dict)

    def register(self, tool: BaseTool) -> None:
        """Register a tool using its intrinsic name."""

        self.tools[tool.name] = tool
        logger.info("Registered tool name=%s", tool.name)

    def get(self, name: str) -> BaseTool:
        """Return a registered tool."""

        tool = self.tools[name]
        logger.debug("Retrieved tool name=%s", name)
        return tool

    def get_all(self) -> Iterable[BaseTool]:
        """Return all registered tools."""

        logger.debug("Retrieving all registered tools count=%s", len(self.tools))
        return self.tools.values()


__all__ = ["ToolRegistry"]

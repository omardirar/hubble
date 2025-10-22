"""MotherDuck tool integration for CrewAI agents."""

from __future__ import annotations

import logging
from typing import Any

from crewai.tools import BaseTool  # type: ignore[import]
from pydantic import Field

logger = logging.getLogger(__name__)


class MotherDuckQueryTool(BaseTool):  # type: ignore[misc]
    """Execute SQL queries on a MotherDuck database."""

    name: str = "motherduck_query"
    description: str = "Execute SQL queries against the MotherDuck database"

    mcp_client: Any = Field(exclude=True)

    def _run(self, query: str) -> str:  # pragma: no cover - thin wrapper
        """Execute the provided SQL query using the MCP client."""

        logger.info("Executing MotherDuck query length=%s", len(query))
        result = self.mcp_client.execute(query)
        logger.debug("MotherDuck query executed successfully")
        return str(result)


__all__ = ["MotherDuckQueryTool"]

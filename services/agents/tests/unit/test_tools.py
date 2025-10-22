"""Tests for tool registry and integrations."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from h10s.tools.motherduck import MotherDuckQueryTool
from h10s.tools.registry import ToolRegistry


def test_tool_registry_registers_and_retrieves_tools() -> None:
    registry = ToolRegistry()
    tool = MotherDuckQueryTool(mcp_client=SimpleNamespace(execute=lambda q: q))

    registry.register(tool)

    assert registry.get(tool.name) is tool
    assert list(registry.get_all()) == [tool]


def test_motherduck_tool_delegates_to_mcp_client() -> None:
    transport = MagicMock()
    transport.execute.return_value = {"rows": []}

    tool = MotherDuckQueryTool(mcp_client=transport)
    result = tool._run("select 1")

    transport.execute.assert_called_once_with("select 1")
    assert result == "{'rows': []}"

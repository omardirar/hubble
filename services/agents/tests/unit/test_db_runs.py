from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from hubble_agents.db.runs import record_agent_run


@pytest.mark.asyncio
async def test_record_agent_run_inserts_payload() -> None:
    mock_execute_result = MagicMock()
    mock_insert = MagicMock()
    mock_insert.execute.return_value = mock_execute_result
    mock_table = MagicMock()
    mock_table.insert.return_value = mock_insert
    mock_client = MagicMock()
    mock_client.table.return_value = mock_table

    with patch("hubble_agents.db.runs.get_supabase_client", return_value=mock_client):
        await record_agent_run(
            org_id="org",
            user_id="user",
            conversation_id="conv",
            prompt="hello",
            response="world",
            usage={"input_tokens": 1},
            text_parts=[{"index": 0, "text": "hello"}],
            child_runs=[{"agent": "analyst", "output": "analysis"}],
        )

    mock_client.table.assert_called_once_with("agent_runs")
    insert_payload = mock_table.insert.call_args[0][0]
    assert insert_payload["org_id"] == "org"
    assert insert_payload["usage"]["input_tokens"] == 1
    assert insert_payload["response"] == "world"
    assert insert_payload["text_parts"] == [{"index": 0, "text": "hello"}]
    assert insert_payload["thinking_parts"] is None
    assert insert_payload["child_runs"] == [{"agent": "analyst", "output": "analysis"}]

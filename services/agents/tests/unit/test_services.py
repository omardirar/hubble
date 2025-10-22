"""Unit tests for service layer components."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from h10s.crews.base import BaseCrew
from h10s.models.domain import Conversation
from h10s.services import AgentExecutionService, ConversationService


@pytest.mark.asyncio
async def test_conversation_service_ensure_conversation_with_access() -> None:
    conversation = Conversation(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        title="Test Conversation",
        created_at=None,
        updated_at=None,
    )

    conversations = MagicMock()
    conversations.ensure_conversation = AsyncMock(return_value=conversation)
    conversations.assert_access = AsyncMock()
    conversations.update_last_message = AsyncMock()

    messages = MagicMock()
    messages.create_user_message = AsyncMock(return_value=(uuid.uuid4(), 1))

    service = ConversationService(conversations, messages)

    result = await service.ensure_conversation_with_access(
        conversation_id=conversation.id,
        org_id=conversation.org_id,
        user_id=conversation.user_id,
        title="Test Conversation",
    )

    assert result is conversation
    conversations.ensure_conversation.assert_awaited_once()
    conversations.assert_access.assert_awaited_once()


@pytest.mark.asyncio
async def test_conversation_service_create_user_message_updates_last_message() -> None:
    conversation_id = uuid.uuid4()
    message_id = uuid.uuid4()

    conversations = MagicMock()
    conversations.update_last_message = AsyncMock()

    messages = MagicMock()
    messages.create_user_message = AsyncMock(return_value=(message_id, 3))

    service = ConversationService(conversations, messages)

    result = await service.create_user_message(
        conversation_id=conversation_id,
        content={"schema_version": 1},
    )

    assert result == (message_id, 3)
    messages.create_user_message.assert_awaited_once()
    conversations.update_last_message.assert_awaited_once_with(
        conversation_id=conversation_id,
        message_id=message_id,
    )


class _StubCrew(BaseCrew):
    def __init__(self) -> None:
        self.settings = SimpleNamespace(crew_version="1.0", environment="test")  # type: ignore[assignment]
        self.tools = MagicMock()  # type: ignore[assignment]

    @property
    def name(self) -> str:  # pragma: no cover - simple property
        return "stub"

    @property
    def version(self) -> str:  # pragma: no cover - simple property
        return "1.0"

    def build(self, prompt: str) -> Any:  # type: ignore[override]
        """Build method for stub crew."""
        return MagicMock()


@pytest.mark.asyncio
async def test_agent_execution_service_execute_crew_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    messages = MagicMock()
    messages.upsert_assistant_message = AsyncMock()

    runs = MagicMock()
    runs.update_status = AsyncMock()

    service = AgentExecutionService(messages, runs)

    crew = _StubCrew()
    crew_instance = MagicMock()
    crew_instance.kickoff = MagicMock(return_value="result")
    crew.build = MagicMock(return_value=crew_instance)  # type: ignore[method-assign]

    result = await service.execute_crew(
        crew=crew,
        conversation_id=uuid.uuid4(),
        prompt="Prompt",
        user_message_seq=1,
        run_id=uuid.uuid4(),
    )

    assert result == "result"
    messages.upsert_assistant_message.assert_awaited()
    runs.update_status.assert_awaited()


@pytest.mark.asyncio
async def test_agent_execution_service_execute_crew_failure() -> None:
    messages = MagicMock()
    messages.upsert_assistant_message = AsyncMock()

    runs = MagicMock()
    runs.update_status = AsyncMock()

    service = AgentExecutionService(messages, runs)

    crew = _StubCrew()
    crew_instance = MagicMock()
    crew_instance.kickoff = MagicMock(side_effect=RuntimeError("boom"))
    crew.build = MagicMock(return_value=crew_instance)  # type: ignore[method-assign]

    with pytest.raises(RuntimeError):
        await service.execute_crew(
            crew=crew,
            conversation_id=uuid.uuid4(),
            prompt="Prompt",
            user_message_seq=1,
            run_id=uuid.uuid4(),
        )

    assert messages.upsert_assistant_message.await_count >= 1
    assert runs.update_status.await_count >= 1

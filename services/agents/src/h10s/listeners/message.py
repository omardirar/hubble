"""Listener responsible for persisting streamed message content."""

from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping
from typing import Any

from h10s.db.repositories import ConversationRepository, MessageRepository

logger = logging.getLogger(__name__)


class MessagePersistenceListener:
    """Database-backed message persistence using official CrewAI event bus."""

    def __init__(
        self,
        messages: MessageRepository,
        conversations: ConversationRepository,
    ) -> None:
        self._messages = messages
        self._conversations = conversations

    def setup_listeners(self, crewai_event_bus: Any | None = None) -> None:
        """Attach event handlers to capture message-related events."""

        try:
            from crewai.events import (  # type: ignore[import-untyped]
                LLMStreamChunkEvent,
                TaskCompletedEvent,
            )
            from crewai.events import (  # type: ignore[import-untyped]
                crewai_event_bus as default_bus,
            )
        except ImportError as exc:  # pragma: no cover
            logger.warning("CrewAI events not available: %s. Message listener disabled.", exc)
            return

        event_bus = crewai_event_bus or default_bus

        # Register handlers using official @on decorator pattern
        @event_bus.on(LLMStreamChunkEvent)  # type: ignore[misc]
        def handle_stream_chunk(source: Any, event: LLMStreamChunkEvent) -> None:
            """Handle streaming chunks for message updates."""
            # Note: This is a sync handler, actual DB work happens via API hooks
            logger.debug("LLM stream chunk received")

        @event_bus.on(TaskCompletedEvent)  # type: ignore[misc]
        def handle_task_completed(source: Any, event: TaskCompletedEvent) -> None:
            """Handle task completion for message finalization."""
            logger.debug("Task completed: %s", getattr(event, "task_id", "unknown"))

        logger.info("Message persistence event bus listeners registered")

    async def ensure_user_message(
        self,
        *,
        conversation_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        content: Mapping[str, Any],
    ) -> tuple[uuid.UUID, int]:
        """Idempotently record the originating user message."""

        _ = (org_id, user_id)
        logger.debug(
            "Ensuring user message conversation_id=%s org_id=%s user_id=%s",
            conversation_id,
            org_id,
            user_id,
        )
        message_id, seq = await self._messages.create_user_message(
            conversation_id=conversation_id,
            content=dict(content),
        )
        await self._conversations.update_last_message(
            conversation_id=conversation_id, message_id=message_id
        )
        logger.info(
            "User message ensured conversation_id=%s message_id=%s seq=%s",
            conversation_id,
            message_id,
            seq,
        )
        return message_id, seq

    async def update_assistant_message(
        self,
        *,
        conversation_id: uuid.UUID,
        run_id: uuid.UUID,
        seq: int,
        status: str,
        content: Mapping[str, Any],
        message_id: uuid.UUID | None = None,
    ) -> uuid.UUID:
        """Persist the assistant-facing message content."""

        message_id = await self._messages.upsert_assistant_message(
            conversation_id=conversation_id,
            run_id=run_id,
            seq=seq,
            status=status,
            content=dict(content),
            message_id=message_id,
        )
        await self._conversations.update_last_message(
            conversation_id=conversation_id, message_id=message_id
        )
        logger.info(
            "Assistant message updated conversation_id=%s run_id=%s seq=%s status=%s message_id=%s",
            conversation_id,
            run_id,
            seq,
            status,
            message_id,
        )
        return message_id


__all__ = ["MessagePersistenceListener"]

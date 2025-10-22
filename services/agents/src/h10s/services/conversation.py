"""Business logic for conversation management."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from h10s.db.repositories import ConversationRepository, MessageRepository
from h10s.models.domain import Conversation, ConversationCreate

logger = logging.getLogger(__name__)


class ConversationService:
    """Conversation orchestration utilities."""

    def __init__(
        self,
        conversations: ConversationRepository,
        messages: MessageRepository,
    ) -> None:
        self._conversations = conversations
        self._messages = messages

    async def ensure_conversation_with_access(
        self,
        *,
        conversation_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Conversation:
        """Ensure a conversation exists and the user has access to it."""

        logger.debug(
            "Ensuring conversation access conversation_id=%s org_id=%s user_id=%s",
            conversation_id,
            org_id,
            user_id,
        )
        conversation = await self._conversations.ensure_conversation(
            data=ConversationCreate(
                conversation_id=conversation_id,
                org_id=org_id,
                user_id=user_id,
                title=title,
                metadata=metadata or {},
            )
        )

        await self._conversations.assert_access(
            conversation_id=conversation_id,
            org_id=org_id,
            user_id=user_id,
        )

        logger.info(
            "Access granted for conversation_id=%s org_id=%s user_id=%s",
            conversation_id,
            org_id,
            user_id,
        )

        return conversation

    async def create_user_message(
        self,
        *,
        conversation_id: uuid.UUID,
        content: dict[str, Any],
    ) -> tuple[uuid.UUID, int]:
        """Create a user-authored message and update conversation metadata."""

        logger.debug("Creating user message for conversation_id=%s", conversation_id)
        message_id, seq = await self._messages.create_user_message(
            conversation_id=conversation_id,
            content=content,
        )

        await self._conversations.update_last_message(
            conversation_id=conversation_id,
            message_id=message_id,
        )

        logger.info(
            "User message stored conversation_id=%s message_id=%s seq=%s",
            conversation_id,
            message_id,
            seq,
        )

        return message_id, seq


__all__ = ["ConversationService"]

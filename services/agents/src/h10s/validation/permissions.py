"""Authorization utilities for conversation-scoped operations."""

from __future__ import annotations

import uuid

from h10s.db.repositories import ConversationRepository


class PermissionValidator:
    """Performs authorization checks against persistence layers."""

    def __init__(self, conversations: ConversationRepository) -> None:
        self._conversations = conversations

    async def require_conversation_access(
        self,
        *,
        conversation_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        """Ensure the given user has access to the conversation."""

        await self._conversations.assert_access(
            conversation_id=conversation_id,
            org_id=org_id,
            user_id=user_id,
        )


__all__ = ["PermissionValidator"]

"""Supabase-backed repository for conversation metadata."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from supabase import AsyncClient  # type: ignore[attr-defined]

from h10s.db.supabase_client import SupabaseClient
from h10s.exceptions import AuthorizationError
from h10s.models.domain import Conversation, ConversationCreate, ConversationUpdate

logger = logging.getLogger(__name__)


class ConversationRepository:
    """Provides helpers to manage conversations via Supabase."""

    def __init__(self, db: SupabaseClient) -> None:
        self._db = db

    async def ensure_conversation(self, *, data: ConversationCreate) -> Conversation:
        """Idempotently ensure that a conversation row exists."""

        logger.debug(
            "Ensuring conversation persistency conversation_id=%s org_id=%s user_id=%s",
            data.conversation_id,
            data.org_id,
            data.user_id,
        )
        payload: dict[str, Any] = {
            "id": str(data.conversation_id),
            "org_id": str(data.org_id),
            "user_id": str(data.user_id),
        }
        if data.title is not None:
            title = data.title.strip() if isinstance(data.title, str) else data.title
            payload["title"] = title or "New Chat"
        if data.metadata:
            payload["metadata"] = data.metadata

        async def _perform_upsert(client: AsyncClient) -> Any:
            return await (
                client.table("conversations")
                # Do not overwrite existing ownership details when the conversation already exists.
                .upsert(payload, on_conflict="id", ignore_duplicates=True)
                .execute()
            )

        response = await self._db.execute(
            description="upserting conversation",
            operation=_perform_upsert,
        )

        rows: list[Any] = response.data or []
        if not rows:

            async def _fetch_existing(client: AsyncClient) -> Any:
                return await (
                    client.table("conversations")
                    .select("*")
                    .eq("id", str(data.conversation_id))
                    .limit(1)
                    .execute()
                )

            existing = await self._db.execute(
                description="fetching existing conversation",
                operation=_fetch_existing,
            )
            rows = existing.data or []

        if not rows:
            logger.error("Conversation ensure failed for id=%s", data.conversation_id)
            raise RuntimeError("Failed to ensure conversation exists")

        record = rows[0]
        if not isinstance(record, dict):
            raise RuntimeError(f"Unexpected conversation response type: {type(record)}")

        conversation = Conversation(**record)
        logger.info(
            "Ensured conversation id=%s title=%s",
            conversation.id,
            conversation.title,
        )
        return conversation

    async def update_conversation(
        self, *, conversation_id: uuid.UUID, data: ConversationUpdate
    ) -> None:
        """Apply a partial update to the conversation."""

        update_payload: dict[str, Any] = {}

        if data.title is not None:
            update_payload["title"] = data.title
        if data.status is not None:
            update_payload["status"] = data.status.value
        if data.last_message_id is not None:
            update_payload["last_message_id"] = str(data.last_message_id)
        if data.last_run_id is not None:
            update_payload["last_run_id"] = str(data.last_run_id)
        if data.metadata is not None:
            update_payload["metadata"] = data.metadata

        if not update_payload:
            logger.debug("No conversation updates to apply conversation_id=%s", conversation_id)
            return

        async def _apply_update(client: AsyncClient) -> Any:
            return await (
                client.table("conversations")
                .update(update_payload)
                .eq("id", str(conversation_id))
                .execute()
            )

        await self._db.execute(
            description="updating conversation metadata",
            operation=_apply_update,
        )
        logger.info(
            "Conversation metadata updated conversation_id=%s fields=%s",
            conversation_id,
            list(update_payload.keys()),
        )

    async def update_last_message(
        self, *, conversation_id: uuid.UUID, message_id: uuid.UUID
    ) -> None:
        """Record the latest message pointer on the conversation."""

        async def _update_last_message(client: AsyncClient) -> Any:
            return await (
                client.table("conversations")
                .update({"last_message_id": str(message_id)})
                .eq("id", str(conversation_id))
                .execute()
            )

        await self._db.execute(
            description="updating conversation last_message_id",
            operation=_update_last_message,
        )
        logger.debug(
            "Conversation last message updated conversation_id=%s message_id=%s",
            conversation_id,
            message_id,
        )

    async def update_last_run(self, *, conversation_id: uuid.UUID, run_id: uuid.UUID) -> None:
        """Record the most recent run on a conversation."""

        async def _update_last_run(client: AsyncClient) -> Any:
            return await (
                client.table("conversations")
                .update({"last_run_id": str(run_id)})
                .eq("id", str(conversation_id))
                .execute()
            )

        await self._db.execute(
            description="updating conversation last_run_id",
            operation=_update_last_run,
        )
        logger.debug(
            "Conversation last run updated conversation_id=%s run_id=%s",
            conversation_id,
            run_id,
        )

    async def assert_access(
        self,
        *,
        conversation_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        """Verify the conversation belongs to the authenticated scope."""

        async def _assert_access(client: AsyncClient) -> Any:
            return await (
                client.table("conversations")
                .select("id")
                .eq("id", str(conversation_id))
                .eq("org_id", str(org_id))
                .eq("user_id", str(user_id))
                .limit(1)
                .execute()
            )

        response = await self._db.execute(
            description="verifying conversation access",
            operation=_assert_access,
        )

        if not response.data:
            logger.warning(
                "Conversation access denied conversation_id=%s org_id=%s user_id=%s",
                conversation_id,
                org_id,
                user_id,
            )
            raise AuthorizationError("Conversation not accessible to authenticated user.")
        logger.debug(
            "Conversation access verified conversation_id=%s org_id=%s user_id=%s",
            conversation_id,
            org_id,
            user_id,
        )


__all__ = ["ConversationRepository"]

"""Supabase-backed repository for message persistence."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from supabase import AsyncClient  # type: ignore[attr-defined]

from h10s.db.supabase_client import SupabaseClient
from h10s.models.enums import MessageStatus
from h10s.validation import validate_and_serialize_json

logger = logging.getLogger(__name__)


class MessageRepository:
    """Handles CRUD-style operations for chat messages."""

    def __init__(self, db: SupabaseClient) -> None:
        self._db = db

    async def _next_sequence(self, conversation_id: uuid.UUID) -> int:
        async def _rpc_next_seq(client: AsyncClient) -> Any:
            return await client.rpc(
                "get_next_message_seq",
                {"p_conversation_id": str(conversation_id)},
            ).execute()

        response = await self._db.execute(
            description="acquiring next message sequence",
            operation=_rpc_next_seq,
        )
        if response.data is None:
            logger.error("Received null sequence from Supabase conversation_id=%s", conversation_id)
            raise RuntimeError("Failed to acquire next message sequence")
        # RPC returns a single integer value
        if isinstance(response.data, int | str):
            seq = int(response.data)
            logger.debug(
                "Next message sequence obtained conversation_id=%s seq=%s", conversation_id, seq
            )
            return seq
        logger.error(
            "Unexpected response from sequence RPC conversation_id=%s type=%s",
            conversation_id,
            type(response.data),
        )
        raise RuntimeError(f"Unexpected response type from RPC: {type(response.data)}")

    async def create_user_message(
        self,
        *,
        conversation_id: uuid.UUID,
        content: dict[str, Any],
        message_id: uuid.UUID | None = None,
    ) -> tuple[uuid.UUID, int]:
        """Insert a user-authored message and return its ID and sequence."""

        message_uuid = message_id or uuid.uuid4()
        seq = await self._next_sequence(conversation_id)
        validate_and_serialize_json(content)

        payload = {
            "id": str(message_uuid),
            "conversation_id": str(conversation_id),
            "run_id": None,
            "role": "user",
            "seq": seq,
            "content": content,
            "status": MessageStatus.COMPLETE.value,
        }

        async def _upsert_user_message(client: AsyncClient) -> Any:
            return await (
                client.table("messages")
                .upsert(payload, on_conflict="conversation_id,seq")
                .execute()
            )

        await self._db.execute(
            description="upserting user message",
            operation=_upsert_user_message,
        )
        logger.info(
            "User message stored conversation_id=%s message_id=%s seq=%s",
            conversation_id,
            message_uuid,
            seq,
        )

        return message_uuid, seq

    async def upsert_assistant_message(
        self,
        *,
        conversation_id: uuid.UUID,
        run_id: uuid.UUID,
        seq: int,
        content: dict[str, Any],
        status: MessageStatus | str,
        message_id: uuid.UUID | None = None,
    ) -> uuid.UUID:
        """Insert or update the assistant message associated with a run."""

        message_uuid = message_id or uuid.uuid4()
        validate_and_serialize_json(content)

        payload = {
            "id": str(message_uuid),
            "conversation_id": str(conversation_id),
            "run_id": str(run_id),
            "role": "assistant",
            "seq": seq,
            "content": content,
            "status": status.value if isinstance(status, MessageStatus) else status,
        }

        async def _upsert_assistant_message(client: AsyncClient) -> Any:
            return await (
                client.table("messages")
                .upsert(payload, on_conflict="conversation_id,seq")
                .execute()
            )

        await self._db.execute(
            description="upserting assistant message",
            operation=_upsert_assistant_message,
        )
        logger.info(
            "Assistant message upserted conversation_id=%s run_id=%s seq=%s message_id=%s",
            conversation_id,
            run_id,
            seq,
            message_uuid,
        )

        return message_uuid

    async def mark_streaming(
        self,
        *,
        message_id: uuid.UUID,
        status: MessageStatus | str,
        content: dict[str, Any] | None = None,
    ) -> None:
        """Update the message streaming state."""

        update_payload: dict[str, Any] = {
            "status": status.value if isinstance(status, MessageStatus) else status,
        }

        if content is not None:
            validate_and_serialize_json(content)
            update_payload["content"] = content

        async def _update_message(client: AsyncClient) -> Any:
            return await (
                client.table("messages").update(update_payload).eq("id", str(message_id)).execute()
            )

        await self._db.execute(
            description="updating message status/content",
            operation=_update_message,
        )
        logger.debug(
            "Message streaming update applied message_id=%s status=%s content_updated=%s",
            message_id,
            status,
            content is not None,
        )


__all__ = ["MessageRepository"]

"""Persistence helpers for conversations, messages, runs, and events."""

from __future__ import annotations

import json
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal, overload

import asyncpg  # type: ignore[import-untyped]

from .database import SupabaseDatabase

JsonMapping = Mapping[str, Any]


@dataclass(slots=True)
class ConversationContext:
    """Identifiers shared across inserts."""

    conversation_id: uuid.UUID
    org_id: uuid.UUID
    user_id: uuid.UUID | None


@overload
def _as_uuid(value: str | uuid.UUID, *, allow_none: Literal[False] = False) -> uuid.UUID: ...


@overload
def _as_uuid(value: str | uuid.UUID | None, *, allow_none: Literal[True]) -> uuid.UUID | None: ...


def _as_uuid(value: str | uuid.UUID | None, *, allow_none: bool = False) -> uuid.UUID | None:
    if value is None:
        if allow_none:
            return None
        raise ValueError("Expected UUID-compatible value")
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError):
        # Deterministically derive a UUID for non-UUID identifiers
        return uuid.uuid5(uuid.NAMESPACE_URL, str(value))


def _json(value: Mapping[str, Any] | None) -> str:
    return json.dumps(value or {})


class ChatRepository:
    """Repository providing persistence primitives for chats."""

    def __init__(self, db: SupabaseDatabase) -> None:
        self._db = db

    async def ensure_conversation(
        self,
        ctx: ConversationContext,
        *,
        title: str | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> None:
        """Idempotently ensure a conversation row exists."""

        async def _ensure(conn: asyncpg.Connection) -> None:
            await conn.execute(
                """
                insert into public.conversations (
                    id, org_id, created_by_user_id, title, metadata_json
                )
                values (
                    $1::uuid, $2::uuid, coalesce($3::uuid, gen_random_uuid()), $4, $5::jsonb
                )
                on conflict (id) do update
                set updated_at = timezone('utc', now()),
                    title = coalesce(excluded.title, public.conversations.title),
                    metadata_json = public.conversations.metadata_json || excluded.metadata_json
                """,
                ctx.conversation_id,
                ctx.org_id,
                ctx.user_id,
                title,
                _json(metadata),
            )

        await self._db.with_connection(_ensure)

    async def insert_user_message(
        self,
        ctx: ConversationContext,
        *,
        content_blocks: Mapping[str, Any],
        message_id: uuid.UUID | None = None,
        message_hash: str | None = None,
    ) -> tuple[uuid.UUID, int]:
        """Insert a user-authored message and return (id, seq)."""

        msg_id = message_id or uuid.uuid4()

        async def _insert(conn: asyncpg.Connection) -> tuple[uuid.UUID, int]:
            async with conn.transaction():
                # Lock conversation to guarantee monotonic sequence allocation
                await conn.execute(
                    "select 1 from public.conversations where id=$1::uuid for update",
                    ctx.conversation_id,
                )
                seq = await conn.fetchval(
                    (
                        "select coalesce(max(seq), -1) + 1 "
                        "from public.messages where conversation_id=$1::uuid"
                    ),
                    ctx.conversation_id,
                )
                assert isinstance(seq, int)
                await conn.execute(
                    """
                    insert into public.messages (
                        id,
                        conversation_id,
                        org_id,
                        user_id,
                        role,
                        seq,
                        content,
                        stream_state,
                        message_hash
                    )
                    values (
                        $1::uuid,
                        $2::uuid,
                        $3::uuid,
                        $4::uuid,
                        'user',
                        $5,
                        $6::jsonb,
                        'complete',
                        $7
                    )
                    on conflict (conversation_id, seq) do update
                        set content = excluded.content,
                            stream_state = excluded.stream_state,
                            updated_at = timezone('utc', now())
                    """,
                    msg_id,
                    ctx.conversation_id,
                    ctx.org_id,
                    ctx.user_id,
                    seq,
                    json.dumps(content_blocks),
                    message_hash,
                )
                return msg_id, seq

        return await self._db.with_connection(_insert)

    async def upsert_agent_message(
        self,
        ctx: ConversationContext,
        *,
        role: str,
        seq: int,
        content_blocks: Mapping[str, Any],
        stream_state: str,
        message_id: uuid.UUID | None = None,
        author_user_id: uuid.UUID | None = None,
    ) -> uuid.UUID:
        """Insert or update an agent/tool/system message at a known seq."""

        msg_id = message_id or uuid.uuid4()
        await self._db.execute(
            """
            insert into public.messages (
                id, conversation_id, org_id, user_id, role, seq, content, stream_state
            )
            values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::jsonb, $8)
            on conflict (conversation_id, seq) do update
                set content = excluded.content,
                    stream_state = excluded.stream_state,
                    updated_at = timezone('utc', now())
            """,
            msg_id,
            ctx.conversation_id,
            ctx.org_id,
            author_user_id,
            role,
            seq,
            json.dumps(content_blocks),
            stream_state,
        )
        return msg_id

    async def create_crew_run(
        self,
        ctx: ConversationContext,
        *,
        crew_name: str,
        input_payload: Mapping[str, Any],
        triggered_by: uuid.UUID | None,
        model_vendor: str | None = None,
        model_name: str | None = None,
    ) -> uuid.UUID:
        run_id = uuid.uuid4()
        await self._db.execute(
            """
            insert into public.crew_runs (
                id, conversation_id, org_id, triggered_by_user_id, crew_name,
                input_payload_json, status, model_vendor, model_name
            )
            values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::jsonb, 'running', $7, $8)
            """,
            run_id,
            ctx.conversation_id,
            ctx.org_id,
            triggered_by,
            crew_name,
            json.dumps(input_payload),
            model_vendor,
            model_name,
        )
        return run_id

    async def complete_crew_run(
        self,
        run_id: uuid.UUID,
        *,
        status: str,
        usage: Mapping[str, Any] | None,
        trace_url: str | None,
        error: Mapping[str, Any] | None,
    ) -> None:
        await self._db.execute(
            """
            update public.crew_runs
            set status = $2,
                ended_at = timezone('utc', now()),
                usage_json = coalesce($3::jsonb, usage_json),
                trace_url = coalesce($4, trace_url),
                error_json = coalesce($5::jsonb, error_json)
            where id = $1::uuid
            """,
            run_id,
            status,
            json.dumps(usage) if usage else None,
            trace_url,
            json.dumps(error) if error else None,
        )

    async def create_task_run(
        self,
        ctx: ConversationContext,
        *,
        crew_run_id: uuid.UUID,
        task_name: str,
        agent_name: str,
        prompt_digest: str | None = None,
    ) -> uuid.UUID:
        task_id = uuid.uuid4()
        await self._db.execute(
            """
            insert into public.task_runs (
                id, crew_run_id, org_id, task_name, agent_name, prompt_digest, status
            )
            values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, 'running')
            """,
            task_id,
            crew_run_id,
            ctx.org_id,
            task_name,
            agent_name,
            prompt_digest,
        )
        return task_id

    async def complete_task_run(
        self,
        task_run_id: uuid.UUID,
        *,
        status: str,
        output_text: str | None = None,
        artifacts: Mapping[str, Any] | None = None,
    ) -> None:
        await self._db.execute(
            """
            update public.task_runs
            set status = $2,
                ended_at = timezone('utc', now()),
                output_text = coalesce($3, output_text),
                artifacts_json = coalesce($4::jsonb, artifacts_json)
            where id = $1::uuid
            """,
            task_run_id,
            status,
            output_text,
            json.dumps(artifacts) if artifacts else None,
        )

    async def log_agent_event(
        self,
        ctx: ConversationContext,
        *,
        task_run_id: uuid.UUID,
        kind: str,
        payload: Mapping[str, Any],
        span_id: str | None = None,
    ) -> int:
        return int(
            await self._db.fetchval(
                """
                insert into public.agent_events (task_run_id, org_id, kind, data_json, span_id)
                values ($1::uuid, $2::uuid, $3, $4::jsonb, $5)
                returning id
                """,
                task_run_id,
                ctx.org_id,
                kind,
                json.dumps(payload),
                span_id,
            )
        )

    async def register_artifact(
        self,
        ctx: ConversationContext,
        *,
        task_run_id: uuid.UUID,
        artifact_type: str,
        uri: str,
        sha256: str | None,
        size_bytes: int | None,
        metadata: Mapping[str, Any] | None = None,
    ) -> uuid.UUID:
        artifact_id = uuid.uuid4()
        await self._db.execute(
            """
            insert into public.artifacts (
                id, task_run_id, org_id, type, uri, sha256, size_bytes, metadata_json
            )
            values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::jsonb)
            """,
            artifact_id,
            task_run_id,
            ctx.org_id,
            artifact_type,
            uri,
            sha256,
            size_bytes,
            json.dumps(metadata or {}),
        )
        return artifact_id


def context_from_request(request: Mapping[str, Any]) -> ConversationContext:
    """Helper to build a conversation context from request identifiers."""

    conversation_id = _as_uuid(request["conversation_id"])
    org_id = _as_uuid(request["org_id"])
    user_id = _as_uuid(request.get("user_id"), allow_none=True)

    return ConversationContext(
        conversation_id=conversation_id,
        org_id=org_id,
        user_id=user_id,
    )


__all__ = [
    "ChatRepository",
    "ConversationContext",
    "context_from_request",
]

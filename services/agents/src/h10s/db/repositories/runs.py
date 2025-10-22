"""Supabase-backed repository for crew run lifecycle data."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from supabase import AsyncClient  # type: ignore[attr-defined]

from h10s.db.supabase_client import SupabaseClient
from h10s.models.enums import RunStatus
from h10s.validation import validate_and_serialize_json

logger = logging.getLogger(__name__)


class RunRepository:
    """Persist run metadata, status, and usage stats via Supabase."""

    def __init__(self, db: SupabaseClient) -> None:
        self._db = db

    async def create_run(
        self,
        *,
        run_id: uuid.UUID,
        conversation_id: uuid.UUID,
        crew_name: str,
        crew_version: str,
        status: RunStatus | str,
        content: dict[str, Any] | None = None,
    ) -> None:
        """Create a new run row if it does not already exist."""

        validate_and_serialize_json(content or {})

        payload = {
            "id": str(run_id),
            "conversation_id": str(conversation_id),
            "crew_name": crew_name,
            "crew_version": crew_version,
            "status": status.value if isinstance(status, RunStatus) else status,
            "content": content or {},
        }

        async def _upsert_run(client: AsyncClient) -> Any:
            return await client.table("runs").upsert(payload, on_conflict="id").execute()

        await self._db.execute(
            description="upserting run metadata",
            operation=_upsert_run,
        )
        logger.info(
            "Run metadata upserted run_id=%s conversation_id=%s crew=%s/%s status=%s",
            run_id,
            conversation_id,
            crew_name,
            crew_version,
            status,
        )

    async def update_status(
        self,
        *,
        run_id: uuid.UUID,
        status: RunStatus | str,
        content: dict[str, Any] | None = None,
        usage: dict[str, Any] | None = None,
        conversation_id: uuid.UUID | None = None,
    ) -> None:
        """Update the run status and optional summary content."""

        status_value = status.value if isinstance(status, RunStatus) else status
        update_payload: dict[str, Any] = {
            "status": status_value,
            "updated_at": datetime.now(tz=UTC).isoformat(),
        }

        if content is not None:
            validate_and_serialize_json(content)
            update_payload["content"] = content

        if status_value in {
            RunStatus.COMPLETE.value,
            RunStatus.FAILED.value,
            RunStatus.CANCELLED.value,
        }:
            update_payload["completed_at"] = datetime.now(tz=UTC).isoformat()

        async def _update_run(client: AsyncClient) -> Any:
            return await client.table("runs").update(update_payload).eq("id", str(run_id)).execute()

        await self._db.execute(
            description="updating run status",
            operation=_update_run,
        )
        logger.info(
            "Run status updated run_id=%s status=%s content_updated=%s usage=%s",
            run_id,
            status_value,
            content is not None,
            bool(usage),
        )

        if usage and conversation_id is not None:
            await self._upsert_usage(
                run_id=run_id,
                conversation_id=conversation_id,
                usage=usage,
            )

    async def _upsert_usage(
        self,
        *,
        run_id: uuid.UUID,
        conversation_id: uuid.UUID,
        usage: dict[str, Any],
    ) -> None:
        llm_provider = usage.get("llm_provider")
        llm_model = usage.get("llm_model")
        tokens = usage.get("tokens", {})
        validate_and_serialize_json(tokens)

        async def _fetch_conversation_org(client: AsyncClient) -> Any:
            return await (
                client.table("conversations")
                .select("org_id")
                .eq("id", str(conversation_id))
                .limit(1)
                .execute()
            )

        conversation_response = await self._db.execute(
            description="fetching conversation for usage aggregation",
            operation=_fetch_conversation_org,
        )
        if not conversation_response.data or len(conversation_response.data) == 0:
            logger.error(
                "Conversation not found when recording usage run_id=%s conversation_id=%s",
                run_id,
                conversation_id,
            )
            raise RuntimeError("Conversation not found when recording usage")

        conversation_data = conversation_response.data[0]
        if not isinstance(conversation_data, dict):
            raise RuntimeError(f"Unexpected conversation data type: {type(conversation_data)}")

        org_id = str(conversation_data["org_id"])

        async def _fetch_existing_usage(client: AsyncClient) -> Any:
            return await (
                client.table("usage")
                .select("tokens")
                .eq("run_id", str(run_id))
                .eq("llm_provider", llm_provider)
                .eq("llm_model", llm_model)
                .limit(1)
                .execute()
            )

        existing_response = await self._db.execute(
            description="fetching existing usage metrics",
            operation=_fetch_existing_usage,
        )

        merged_tokens: dict[str, Any]
        if existing_response.data and len(existing_response.data) > 0:
            existing_data = existing_response.data[0]
            if isinstance(existing_data, dict):
                existing_tokens = existing_data.get("tokens")
                if isinstance(existing_tokens, dict):
                    merged_tokens = {**existing_tokens, **tokens}
                else:
                    merged_tokens = tokens
            else:
                merged_tokens = tokens
        else:
            merged_tokens = tokens

        usage_payload = {
            "run_id": str(run_id),
            "conversation_id": str(conversation_id),
            "org_id": org_id,
            "llm_provider": llm_provider,
            "llm_model": llm_model,
            "tokens": merged_tokens,
        }

        async def _upsert_usage(client: AsyncClient) -> Any:
            return await (
                client.table("usage")
                .upsert(usage_payload, on_conflict="run_id,llm_provider,llm_model")
                .execute()
            )

        await self._db.execute(
            description="upserting usage metrics",
            operation=_upsert_usage,
        )
        logger.debug(
            "Usage metrics recorded run_id=%s llm_provider=%s llm_model=%s tokens_keys=%s",
            run_id,
            llm_provider,
            llm_model,
            list(merged_tokens.keys()),
        )


__all__ = ["RunRepository"]

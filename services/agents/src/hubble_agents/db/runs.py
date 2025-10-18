"""Persistence helpers for recording agent executions."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from .client import get_supabase_client


async def record_agent_run(
    *,
    org_id: str,
    user_id: str,
    conversation_id: str,
    prompt: str,
    response: str,
    usage: dict[str, Any] | None,
    text_parts: list[dict[str, Any]] | None = None,
    thinking_parts: list[dict[str, Any]] | None = None,
    tool_results: list[dict[str, Any]] | None = None,
    child_runs: list[dict[str, Any]] | None = None,
) -> None:
    """Persist a completed agent run to Supabase."""

    client = get_supabase_client()
    payload = {
        "org_id": org_id,
        "user_id": user_id,
        "conversation_id": conversation_id,
        "prompt": prompt,
        "response": response,
        "usage": usage,
        "text_parts": text_parts,
        "thinking_parts": thinking_parts,
        "tool_results": tool_results,
        "child_runs": child_runs,
        "created_at": datetime.now(UTC).isoformat(),
    }

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:  # pragma: no cover - fallback for sync contexts
        loop = asyncio.get_event_loop()

    await loop.run_in_executor(None, lambda: client.table("agent_runs").insert(payload).execute())

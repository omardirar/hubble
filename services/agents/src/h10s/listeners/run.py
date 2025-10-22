"""Listener tracking the lifecycle of crew runs using official CrewAI events."""

from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping
from typing import Any

from h10s.db.repositories import ConversationRepository, RunRepository

logger = logging.getLogger(__name__)


class RunLifecycleListener:
    """Persist crew run status changes and usage metrics.

    Uses the official CrewAI event bus to listen for run lifecycle events.
    """

    def __init__(
        self,
        runs: RunRepository,
        conversations: ConversationRepository,
    ) -> None:
        self._runs = runs
        self._conversations = conversations

    def setup_listeners(self, crewai_event_bus: Any | None = None) -> None:
        """Attach event handlers for run started/completed using official CrewAI events."""

        try:
            from crewai.events import (  # type: ignore[import-untyped]
                CrewKickoffCompletedEvent,
                CrewKickoffFailedEvent,
                LLMCallCompletedEvent,
            )
            from crewai.events import (  # type: ignore[import-untyped]
                crewai_event_bus as default_bus,
            )
        except ImportError as exc:  # pragma: no cover
            logger.warning("CrewAI events not available: %s. Run listener disabled.", exc)
            return

        event_bus = crewai_event_bus or default_bus

        # Register handlers using official @on decorator pattern
        @event_bus.on(CrewKickoffCompletedEvent)  # type: ignore[misc]
        def handle_crew_completed(source: Any, event: CrewKickoffCompletedEvent) -> None:
            """Handle crew completion for final run status update."""
            # Note: This is a sync handler, actual DB work happens via API hooks
            # CrewAI event handlers should be lightweight
            logger.debug("Crew completed: %s", getattr(event, "run_id", "unknown"))

        @event_bus.on(CrewKickoffFailedEvent)  # type: ignore[misc]
        def handle_crew_failed(source: Any, event: CrewKickoffFailedEvent) -> None:
            """Handle crew failure event."""
            logger.warning("Crew failed: %s", getattr(event, "run_id", "unknown"))

        @event_bus.on(LLMCallCompletedEvent)  # type: ignore[misc]
        def handle_llm_usage(source: Any, event: LLMCallCompletedEvent) -> None:
            """Track LLM usage metrics."""
            # Extract usage information for metrics
            usage = getattr(event, "usage", None)
            if usage:
                logger.debug("LLM usage recorded: %s", usage)

        logger.info("Run lifecycle event bus listeners registered")

    async def record_run_start(
        self,
        *,
        run_id: uuid.UUID,
        conversation_id: uuid.UUID,
        crew_name: str,
        crew_version: str,
    ) -> None:
        """Persist initial run metadata."""

        await self._runs.create_run(
            run_id=run_id,
            conversation_id=conversation_id,
            crew_name=crew_name,
            crew_version=crew_version,
            status="running",
            content={},
        )
        await self._conversations.update_last_run(conversation_id=conversation_id, run_id=run_id)
        logger.info(
            "Run started run_id=%s conversation_id=%s crew=%s/%s",
            run_id,
            conversation_id,
            crew_name,
            crew_version,
        )

    async def record_run_completion(
        self,
        *,
        run_id: uuid.UUID,
        conversation_id: uuid.UUID,
        status: str,
        summary: Mapping[str, Any] | None = None,
        usage: Mapping[str, Any] | None = None,
    ) -> None:
        """Update the status and summary of a run."""

        await self._runs.update_status(
            run_id=run_id,
            status=status,
            content=dict(summary or {}),
            usage=dict(usage or {}),
            conversation_id=conversation_id,
        )
        logger.info(
            "Run completion persisted run_id=%s conversation_id=%s status=%s usage=%s",
            run_id,
            conversation_id,
            status,
            bool(usage),
        )


__all__ = ["RunLifecycleListener"]

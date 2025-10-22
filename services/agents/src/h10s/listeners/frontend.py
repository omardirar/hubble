"""Frontend-facing SSE listener using official CrewAI event bus."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from h10s.config import get_settings
from h10s.listeners.lazy_stream import LazySSEBroker
from h10s.models.events import SSEvent

logger = logging.getLogger(__name__)


class FrontendSSEListener:
    """Translate CrewAI events into SSE frames for streaming responses.

    Uses the official CrewAI event bus with proper event classes and
    decorator-based registration.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._broker = LazySSEBroker(settings.sse_retry_millis)
        self._tasks: set[asyncio.Task[Any]] = set()

    def setup_listeners(self, crewai_event_bus: Any | None = None) -> None:
        """Register event handlers on the CrewAI event bus using official API."""

        try:
            # Import official CrewAI event classes
            from crewai.events import (  # type: ignore[import-untyped]
                CrewKickoffCompletedEvent,
                CrewKickoffStartedEvent,
                LLMStreamChunkEvent,
                TaskCompletedEvent,
                TaskStartedEvent,
            )
            from crewai.events import (  # type: ignore[import-untyped]
                crewai_event_bus as default_bus,
            )
        except ImportError as exc:  # pragma: no cover
            logger.warning("CrewAI events not available: %s. SSE listener disabled.", exc)
            return

        event_bus = crewai_event_bus or default_bus

        # Register handlers using official @on decorator pattern
        @event_bus.on(CrewKickoffStartedEvent)  # type: ignore[misc]
        def handle_crew_started(source: Any, event: CrewKickoffStartedEvent) -> None:
            """Handle crew kickoff started event."""
            self._handle_crew_started(source, event)

        @event_bus.on(CrewKickoffCompletedEvent)  # type: ignore[misc]
        def handle_crew_completed(source: Any, event: CrewKickoffCompletedEvent) -> None:
            """Handle crew kickoff completed event."""
            self._handle_crew_completed(source, event)

        @event_bus.on(TaskStartedEvent)  # type: ignore[misc]
        def handle_task_started(source: Any, event: TaskStartedEvent) -> None:
            """Handle task started event."""
            self._handle_task_started(source, event)

        @event_bus.on(TaskCompletedEvent)  # type: ignore[misc]
        def handle_task_completed(source: Any, event: TaskCompletedEvent) -> None:
            """Handle task completed event."""
            self._handle_task_completed(source, event)

        @event_bus.on(LLMStreamChunkEvent)  # type: ignore[misc]
        def handle_llm_chunk(source: Any, event: LLMStreamChunkEvent) -> None:
            """Handle LLM streaming chunk event."""
            self._handle_llm_chunk(source, event)

        logger.info("CrewAI event bus listeners registered successfully")

    async def create_pending_stream(self, correlation_id: str) -> asyncio.Queue[SSEvent | None]:
        """Create a pending stream that will activate when CrewAI events arrive.

        Args:
            correlation_id: API-generated correlation ID passed to crew

        Returns:
            Queue that will receive events once stream is activated
        """
        logger.debug("Creating pending SSE stream correlation_id=%s", correlation_id)
        return await self._broker.create_pending_stream(correlation_id)

    async def publish(self, event: SSEvent) -> None:
        """Publish an event to the associated SSE stream."""
        logger.debug("Publishing SSE event crew_run_id=%s event=%s", event.crew_run_id, event.event)
        await self._broker.publish(event)

    async def close_stream(self, crew_run_id: str) -> None:
        """Signal the end of the SSE stream."""
        logger.info("Closing SSE stream crew_run_id=%s", crew_run_id)
        await self._broker.close(crew_run_id)

    def _schedule_publish(self, event: SSEvent) -> None:
        """Schedule an async publish task."""
        task = asyncio.create_task(self.publish(event))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        logger.debug(
            "Scheduled publish for crew_run_id=%s event=%s",
            event.crew_run_id,
            event.event,
        )

    def _handle_crew_started(self, source: Any, event: Any) -> None:
        """Handle crew kickoff started event."""
        run_id = getattr(event, "run_id", None) or getattr(event, "crew_run_id", None)
        if run_id is None:
            logger.warning("Crew started event missing run_id")
            return

        # Extract correlation_id if present (passed via crew inputs)
        correlation_id = getattr(event, "correlation_id", None) or getattr(
            event, "_correlation_id", None
        )

        # Activate pending stream if correlation_id is found
        if correlation_id:
            activate_task = asyncio.create_task(
                self._broker.activate_stream(str(run_id), str(correlation_id))
            )
            self._tasks.add(activate_task)
            activate_task.add_done_callback(self._tasks.discard)
            logger.debug(
                "Activating SSE stream run_id=%s correlation_id=%s",
                run_id,
                correlation_id,
            )

        self._schedule_publish(
            SSEvent(
                crew_run_id=str(run_id),
                event="crew_run.started",
                payload={"status": "running"},
            )
        )

    def _handle_crew_completed(self, source: Any, event: Any) -> None:
        """Handle crew kickoff completed event."""
        run_id = getattr(event, "run_id", None) or getattr(event, "crew_run_id", None)
        if run_id is None:
            logger.warning("Crew completed event missing run_id")
            return

        status = getattr(event, "status", "complete")
        logger.info("Crew completed run_id=%s status=%s", run_id, status)
        self._schedule_publish(
            SSEvent(
                crew_run_id=str(run_id),
                event="crew_run.completed",
                payload={"status": status},
            )
        )

        # Close the stream
        close_task = asyncio.create_task(self.close_stream(str(run_id)))
        self._tasks.add(close_task)
        close_task.add_done_callback(self._tasks.discard)

    def _handle_task_started(self, source: Any, event: Any) -> None:
        """Handle task started event."""
        run_id = getattr(event, "run_id", None) or getattr(event, "crew_run_id", None)
        task_id = getattr(event, "task_id", None) or getattr(event, "id", None)

        if run_id is None:
            return

        logger.debug("Crew task started run_id=%s task_id=%s", run_id, task_id)
        self._schedule_publish(
            SSEvent(
                crew_run_id=str(run_id),
                event="task.started",
                payload={"task_id": str(task_id) if task_id else None, "status": "running"},
                context={"task_id": str(task_id)} if task_id else {},
            )
        )

    def _handle_task_completed(self, source: Any, event: Any) -> None:
        """Handle task completed event."""
        run_id = getattr(event, "run_id", None) or getattr(event, "crew_run_id", None)
        task_id = getattr(event, "task_id", None) or getattr(event, "id", None)
        status = getattr(event, "status", "complete")

        if run_id is None:
            return

        logger.debug(
            "Crew task completed run_id=%s task_id=%s status=%s",
            run_id,
            task_id,
            status,
        )
        self._schedule_publish(
            SSEvent(
                crew_run_id=str(run_id),
                event="task.completed",
                payload={"task_id": str(task_id) if task_id else None, "status": status},
                context={"task_id": str(task_id)} if task_id else {},
            )
        )

    def _handle_llm_chunk(self, source: Any, event: Any) -> None:
        """Handle LLM streaming chunk event."""
        run_id = getattr(event, "run_id", None) or getattr(event, "crew_run_id", None)
        chunk = getattr(event, "chunk", None) or getattr(event, "content", None)

        if run_id is None or chunk is None:
            return

        logger.debug("LLM chunk received run_id=%s size=%s", run_id, len(str(chunk)))
        self._schedule_publish(
            SSEvent(
                crew_run_id=str(run_id),
                event="block.delta",
                payload={"delta": chunk},
            )
        )


__all__ = ["FrontendSSEListener", "SSEvent"]

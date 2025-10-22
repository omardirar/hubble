"""Placeholder telemetry listener for future tracing integration."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class TelemetryListener:
    """Forward events to external telemetry systems using official CrewAI event bus."""

    def setup_listeners(self, crewai_event_bus: Any | None = None) -> None:
        """Register telemetry handlers on the CrewAI event bus."""

        try:
            from crewai.events import (  # type: ignore[import-untyped]
                LLMCallCompletedEvent,
            )
            from crewai.events import (  # type: ignore[import-untyped]
                crewai_event_bus as default_bus,
            )
        except ImportError as exc:  # pragma: no cover
            logger.debug("CrewAI events not available: %s. Telemetry listener disabled.", exc)
            return

        event_bus = crewai_event_bus or default_bus

        # Register handlers using official @on decorator pattern
        @event_bus.on(LLMCallCompletedEvent)  # type: ignore[misc]
        def handle_llm_call(source: Any, event: LLMCallCompletedEvent) -> None:
            """Track LLM calls for telemetry."""
            # TODO: Forward to external telemetry system (OpenTelemetry, DataDog, etc.)
            logger.debug("LLM call completed - telemetry hook placeholder")

        logger.info("Telemetry event bus listeners registered")


__all__ = ["TelemetryListener"]

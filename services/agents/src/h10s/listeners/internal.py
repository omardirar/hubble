"""Utilities for registering CrewAI listeners."""

from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any, Protocol

logger = logging.getLogger(__name__)


class EventListenerProtocol(Protocol):
    """Protocol for event listeners with setup_listeners method."""

    def setup_listeners(self, crewai_event_bus: Any | None = None) -> None:
        """Setup event handlers on the CrewAI event bus."""
        ...


@dataclass(slots=True)
class ListenerRegistry:
    """Keep strong references to listeners for the lifetime of the app."""

    listeners: list[EventListenerProtocol] = field(default_factory=list)

    def register(self, listener: EventListenerProtocol) -> None:
        """Store the listener and trigger setup."""

        logger.debug("Registering listener %s", listener.__class__.__name__)
        try:
            listener.setup_listeners()
            self.listeners.append(listener)
            logger.info(
                "Listener registered %s total_listeners=%s",
                listener.__class__.__name__,
                len(self.listeners),
            )
        except Exception as exc:
            logger.error(
                "Failed to register listener %s: %s. Listener will be skipped.",
                listener.__class__.__name__,
                exc,
                exc_info=True,
            )

    def extend(self, listeners: Iterable[EventListenerProtocol]) -> None:
        """Register multiple listeners."""

        for listener in listeners:
            self.register(listener)


__all__ = ["ListenerRegistry"]

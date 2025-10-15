"""Event Stream Broker for SSE streaming to frontend

Converts internal agent events into SSE-compatible JSON events for real-time
streaming to the frontend chat interface.
"""

import asyncio
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

from ..utils.logging import get_logger

logger = get_logger(__name__)


class EventStreamBroker:
    """Broker for streaming events from agents to frontend via SSE

    Features:
    - Async queue for event publishing
    - Delta events for progressive text updates
    - Milestone events for completion markers
    - Keepalive pings to prevent timeout
    - Graceful shutdown with event flushing
    """

    def __init__(self, keepalive_interval: int = 30):
        """Initialize broker

        Args:
            keepalive_interval: Seconds between keepalive pings
        """
        self.queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.closed = False
        self.keepalive_interval = keepalive_interval
        self._event_count = 0

    async def publish_delta(
        self, event_type: str, agent: str, delta: str, event_id: str | None = None
    ) -> None:
        """Publish incremental delta event (TEXT_DELTA, THINKING_DELTA)

        Args:
            event_type: Type of delta (text_delta, thinking_delta)
            agent: Agent name producing the delta
            delta: Incremental text chunk
            event_id: Optional event ID for correlation
        """
        if self.closed:
            return

        await self.queue.put(
            {
                "event": event_type.upper(),
                "data": {
                    "agent": agent,
                    "delta": delta,
                    "event_id": event_id,
                    "timestamp": datetime.now(UTC).isoformat(),
                },
            }
        )
        self._event_count += 1

    async def publish_milestone(self, event_type: str, data: dict[str, Any]) -> None:
        """Publish milestone event (TEXT_COMPLETED, WORKFLOW_COMPLETE, etc.)

        Args:
            event_type: Type of milestone event
            data: Event data payload
        """
        if self.closed:
            return

        # Ensure timestamp is present
        if "timestamp" not in data:
            data["timestamp"] = datetime.now(UTC).isoformat()

        await self.queue.put(
            {
                "event": event_type.upper(),
                "data": data,
            }
        )
        self._event_count += 1

    async def publish_error(self, error: str, error_type: str) -> None:
        """Publish error event

        Args:
            error: Error message
            error_type: Error type/code
        """
        await self.queue.put(
            {
                "event": "ERROR",
                "data": {
                    "error": error,
                    "error_type": error_type,
                    "timestamp": datetime.now(UTC).isoformat(),
                },
            }
        )

    async def get_nowait(self) -> dict[str, Any] | None:
        """Get next event from queue without waiting (non-blocking)

        Returns:
            Event dictionary or None if queue is empty
        """
        try:
            return self.queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    async def subscribe(self) -> AsyncGenerator[dict[str, Any], None]:
        """Subscribe to event stream with keepalive support

        Yields:
            Event dictionaries with 'event' and 'data' keys
        """
        logger.debug("Client subscribed to event stream")
        last_keepalive = asyncio.get_event_loop().time()

        try:
            while not self.closed or not self.queue.empty():
                try:
                    # Wait for event with timeout for keepalive
                    event = await asyncio.wait_for(
                        self.queue.get(), timeout=self.keepalive_interval
                    )
                    yield event
                    last_keepalive = asyncio.get_event_loop().time()

                except TimeoutError:
                    # Send keepalive ping
                    now = asyncio.get_event_loop().time()
                    if now - last_keepalive >= self.keepalive_interval:
                        yield {
                            "event": "PING",
                            "data": {
                                "timestamp": datetime.now(UTC).isoformat(),
                                "events_sent": self._event_count,
                            },
                        }
                        last_keepalive = now

        except asyncio.CancelledError:
            logger.debug("Event stream subscription cancelled")
            raise
        except Exception as e:
            logger.error(f"Error in event subscription: {e}", exc_info=True)
            yield {
                "event": "ERROR",
                "data": {
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "timestamp": datetime.now(UTC).isoformat(),
                },
            }
        finally:
            logger.debug(f"Event stream closed. Total events sent: {self._event_count}")

    async def close(self) -> None:
        """Close broker and signal end of stream"""
        if not self.closed:
            self.closed = True
            logger.debug("Event stream broker closed")

    def is_closed(self) -> bool:
        """Check if broker is closed"""
        return self.closed

    def get_event_count(self) -> int:
        """Get total number of events published"""
        return self._event_count

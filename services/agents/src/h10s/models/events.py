"""Models describing SSE streaming payloads."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from h10s.models.base import H10SBaseModel

ALLOWED_CONTEXT_KEYS = (
    "task_run_id",
    "agent_run_id",
    "block_id",
    "trace_id",
    "span_id",
)


class EventContext(H10SBaseModel):
    """Identifiers used to correlate related SSE events."""

    task_run_id: str | None = None
    agent_run_id: str | None = None
    block_id: str | None = None
    trace_id: str | None = None
    span_id: str | None = None


class BlockEvent(H10SBaseModel):
    """Content block state streamed to the client."""

    index: int
    type: Literal["reasoning", "response", "tool_call", "tool_result"]
    role: Literal["assistant", "tool"]
    content_type: str = Field(default="text/markdown")
    render_hint: str | None = None
    call_id: str | None = None
    tool_name: str | None = None
    delta: str | None = None
    content: dict[str, Any] | None = None
    redacted: bool = False


class SSEEnvelope(H10SBaseModel):
    """Standard SSE payload envelope."""

    v: str = "1.0"
    crew_run_id: str
    ts: datetime
    ctx: EventContext = Field(default_factory=EventContext)
    payload: dict[str, Any] = Field(default_factory=dict)


@dataclass(slots=True)
class SSEvent:
    """Structured representation of an SSE frame."""

    crew_run_id: str
    event: str
    payload: dict[str, Any] = field(default_factory=dict)
    context: dict[str, Any] = field(default_factory=dict)
    retry: int | None = None
    sequence: int | None = None

    def render(self) -> str:
        """Serialize the event to the SSE wire format."""
        from h10s.utils.sse import format_sse_event
        from h10s.utils.time import utc_now

        context_payload = {
            key: self.context.get(key)
            for key in ALLOWED_CONTEXT_KEYS
            if key in self.context and self.context.get(key) is not None
        }
        envelope = SSEEnvelope(
            crew_run_id=self.crew_run_id,
            ts=utc_now(),
            ctx=EventContext(**context_payload),
            payload=self.payload,
        )
        event_id = f"{self.crew_run_id}:{self.sequence}" if self.sequence is not None else None
        return format_sse_event(
            event=self.event,
            data=envelope.model_dump(mode="json"),
            event_id=event_id,
            retry=self.retry,
        )


__all__ = ["ALLOWED_CONTEXT_KEYS", "BlockEvent", "EventContext", "SSEEnvelope", "SSEvent"]

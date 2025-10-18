"""Event streaming utilities built on top of PydanticAI's `run_stream_events`."""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, cast

from pydantic_ai.messages import (
    AgentStreamEvent,
    FinalResultEvent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPart,
    TextPartDelta,
    ThinkingPart,
    ThinkingPartDelta,
    ToolReturnPart,
)
from pydantic_ai.run import AgentRunResultEvent

AgentEvent = AgentStreamEvent | AgentRunResultEvent[Any]


def _timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _serialise(value: Any) -> Any:
    if isinstance(value, str | int | float | bool) or value is None:
        return value
    if isinstance(value, Mapping):
        return {str(k): _serialise(v) for k, v in value.items()}
    if isinstance(value, list | tuple | set):
        return [_serialise(v) for v in value]
    if hasattr(value, "model_dump"):
        try:
            return _serialise(value.model_dump())
        except Exception:  # pragma: no cover - defensive
            return repr(value)
    return repr(value)


def _normalise_usage(usage: Any) -> dict[str, Any] | None:
    if usage is None:
        return None
    if hasattr(usage, "model_dump"):
        dumped = usage.model_dump()
        return cast(dict[str, Any], dumped)
    if isinstance(usage, dict):
        return dict(usage)
    if hasattr(usage, "__dict__"):
        return {str(k): _serialise(v) for k, v in vars(usage).items() if not k.startswith("_")}
    return None


def format_sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def new_run_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


@dataclass(slots=True)
class EventSource:
    """Metadata describing where an event originated."""

    agent: str
    run_id: str
    parent_run_id: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None

    def as_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "agent": self.agent,
            "run_id": self.run_id,
        }
        if self.parent_run_id:
            data["parent_run_id"] = self.parent_run_id
        if self.tool_name:
            data["tool"] = self.tool_name
        if self.tool_call_id:
            data["tool_call_id"] = self.tool_call_id
        return data


@dataclass(slots=True)
class PendingDelta:
    source: EventSource
    event_type: str
    delta: str
    timer: asyncio.TimerHandle | None = None


@dataclass(slots=True)
class RunState:
    """Incremental state captured for each agent run."""

    run_id: str
    agent: str
    parent_run_id: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    text_parts: dict[int, str] = field(default_factory=dict)
    thinking_parts: dict[int, str] = field(default_factory=dict)
    tool_results: dict[str, dict[str, Any]] = field(default_factory=dict)
    output: Any | None = None
    usage: dict[str, Any] | None = None

    def record_text(self, index: int, value: str) -> None:
        if not value:
            return
        self.text_parts[index] = value

    def append_text(self, index: int, delta: str) -> None:
        if not delta:
            return
        self.text_parts[index] = f"{self.text_parts.get(index, '')}{delta}"

    def record_thinking(self, index: int, value: str) -> None:
        if not value:
            return
        self.thinking_parts[index] = value

    def append_thinking(self, index: int, delta: str) -> None:
        if not delta:
            return
        self.thinking_parts[index] = f"{self.thinking_parts.get(index, '')}{delta}"

    def as_dict(self) -> dict[str, Any]:
        return {
            "agent": self.agent,
            "run_id": self.run_id,
            "tool": self.tool_name,
            "tool_call_id": self.tool_call_id,
            "parent_run_id": self.parent_run_id,
            "output": self.output,
            "usage": self.usage,
            "text_parts": [
                {"index": idx, "text": text}
                for idx, text in sorted(self.text_parts.items())
                if text
            ],
            "thinking_parts": [
                {"index": idx, "thinking": content}
                for idx, content in sorted(self.thinking_parts.items())
                if content
            ],
            "tool_results": [
                {
                    "tool_call_id": call_id,
                    "tool_name": details.get("tool_name"),
                    "content": details.get("content"),
                }
                for call_id, details in self.tool_results.items()
            ],
        }


class RunRecorder:
    """Tracks per-run state to build persistence summaries."""

    def __init__(self) -> None:
        self._states: dict[str, RunState] = {}

    def _ensure_state(self, source: EventSource) -> RunState:
        state = self._states.get(source.run_id)
        if state is None:
            state = RunState(
                run_id=source.run_id,
                agent=source.agent,
                parent_run_id=source.parent_run_id,
                tool_name=source.tool_name,
                tool_call_id=source.tool_call_id,
            )
            self._states[source.run_id] = state
        else:
            state.agent = source.agent
            state.parent_run_id = source.parent_run_id
            state.tool_name = source.tool_name
            state.tool_call_id = source.tool_call_id
        return state

    def observe(self, source: EventSource, event: AgentEvent) -> None:
        state = self._ensure_state(source)

        if isinstance(event, PartStartEvent):
            part = event.part
            if isinstance(part, TextPart):
                state.record_text(event.index, part.content)
            elif isinstance(part, ThinkingPart):
                state.record_thinking(event.index, part.content)
        elif isinstance(event, PartDeltaEvent):
            delta = event.delta
            if isinstance(delta, TextPartDelta):
                state.append_text(event.index, delta.content_delta)
            elif isinstance(delta, ThinkingPartDelta) and delta.content_delta:
                state.append_thinking(event.index, delta.content_delta)
        elif isinstance(event, FunctionToolResultEvent):
            result = event.result
            if isinstance(result, ToolReturnPart):
                state.tool_results[result.tool_call_id] = {
                    "tool_name": result.tool_name,
                    "content": _serialise(result.content),
                }
        elif isinstance(event, AgentRunResultEvent):
            state.output = _serialise(event.result.output)
            state.usage = _normalise_usage(event.result.usage())

    def summary(self, run_id: str) -> dict[str, Any]:
        state = self._states.get(run_id)
        return state.as_dict() if state else {}

    def child_summaries(self, parent_run_id: str) -> list[dict[str, Any]]:
        return [
            state.as_dict()
            for state in self._states.values()
            if state.parent_run_id == parent_run_id
        ]


class EventEncoder:
    """Converts agent events into canonical payloads."""

    def encode(
        self,
        *,
        source: EventSource,
        event: AgentEvent,
    ) -> tuple[str, dict[str, Any]] | None:
        if isinstance(event, PartStartEvent):
            return self._encode_part_start(event)
        if isinstance(event, PartDeltaEvent):
            return self._encode_part_delta(event)
        if isinstance(event, FunctionToolCallEvent):
            return (
                "tool.start",
                {
                    "tool_name": event.part.tool_name,
                    "tool_call_id": event.part.tool_call_id,
                    "args": _serialise(event.part.args),
                },
            )
        if isinstance(event, FunctionToolResultEvent):
            result = event.result
            content = _serialise(getattr(result, "content", None))
            if isinstance(content, str) and len(content) > 160:
                content = None
            return (
                "tool.result",
                {
                    "tool_call_id": getattr(result, "tool_call_id", None),
                    "tool_name": getattr(result, "tool_name", None),
                    "content": content,
                },
            )
        if isinstance(event, FinalResultEvent):
            return None
        if isinstance(event, AgentRunResultEvent):
            usage = _normalise_usage(event.result.usage())
            return (
                "run.result",
                {
                    "output": _serialise(event.result.output),
                    "usage": usage,
                },
            )
        return None

    @staticmethod
    def _encode_part_start(event: PartStartEvent) -> tuple[str, dict[str, Any]] | None:
        part = event.part
        if isinstance(part, TextPart):
            if not part.content:
                return None
            return ("text.delta", {"delta": part.content})
        if isinstance(part, ThinkingPart):
            if not part.content:
                return None
            return ("thinking.delta", {"delta": part.content})
        return None

    @staticmethod
    def _encode_part_delta(event: PartDeltaEvent) -> tuple[str, dict[str, Any]] | None:
        delta = event.delta
        if isinstance(delta, TextPartDelta):
            if not delta.content_delta:
                return None
            return ("text.delta", {"delta": delta.content_delta})
        if isinstance(delta, ThinkingPartDelta):
            if not delta.content_delta:
                return None
            return ("thinking.delta", {"delta": delta.content_delta})
        return None


class EventHub:
    """Queues encoded SSE frames and records run state."""

    def __init__(self) -> None:
        self.recorder = RunRecorder()
        self.encoder = EventEncoder()
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._seq = 0
        self._pending_deltas: dict[tuple[str, str], PendingDelta] = {}
        self._coalesce_window = 0.03
        self._background_tasks: set[asyncio.Task[Any]] = set()

    async def publish(self, source: EventSource, event: AgentEvent) -> None:
        self.recorder.observe(source, event)
        payload = self.encoder.encode(source=source, event=event)
        if payload is None:
            return

        event_type, data = payload
        if event_type in {"text.delta", "thinking.delta"}:
            delta_text = data.get("delta")
            if not isinstance(delta_text, str) or not delta_text:
                return
            buffered = await self._buffer_delta(source, event_type, delta_text)
            if buffered:
                return
            # if buffering decided to flush immediately, continue
            return

        await self._flush_pending_for_run(source.run_id)
        await self._emit_frame(source=source, event_type=event_type, data=data)

    async def emit_manual(
        self,
        *,
        source: EventSource,
        event_type: str,
        data: dict[str, Any],
    ) -> None:
        await self._flush_pending_for_run(source.run_id)
        await self._emit_frame(source=source, event_type=event_type, data=data)

    async def next_frame(self, *, timeout: float | None = None) -> str | None:
        if timeout is None:
            return await self._queue.get()
        try:
            return await asyncio.wait_for(self._queue.get(), timeout=timeout)
        except TimeoutError:
            return None

    def heartbeat_frame(self) -> str:
        return format_sse("ping", {"ts": _timestamp()})

    def empty(self) -> bool:
        return self._queue.empty()

    async def flush_all(self) -> None:
        keys = list(self._pending_deltas.keys())
        for key in keys:
            await self._flush_pending_delta(key)

    async def _emit_frame(
        self,
        *,
        source: EventSource,
        event_type: str,
        data: dict[str, Any],
    ) -> None:
        self._seq += 1
        payload = {
            "id": f"evt_{uuid.uuid4().hex[:8]}",
            "ts": _timestamp(),
            "seq": self._seq,
            "source": source.as_dict(),
            "type": event_type,
            "data": data,
        }
        await self._queue.put(format_sse("agent.event", payload))

    async def _buffer_delta(
        self,
        source: EventSource,
        event_type: str,
        delta: str,
    ) -> bool:
        key = (source.run_id, event_type)
        pending = self._pending_deltas.get(key)
        loop = asyncio.get_running_loop()

        if pending is None:

            def flush_callback() -> None:
                self._schedule_flush_task(key)

            timer = loop.call_later(
                self._coalesce_window,
                flush_callback,
            )
            self._pending_deltas[key] = PendingDelta(
                source=source,
                event_type=event_type,
                delta=delta,
                timer=timer,
            )
            return True

        pending.delta += delta
        if pending.timer:
            pending.timer.cancel()
        pending.timer = loop.call_later(
            self._coalesce_window,
            lambda: self._schedule_flush_task(key),
        )
        return True

    async def _flush_pending_for_run(self, run_id: str) -> None:
        keys = [key for key in self._pending_deltas if key[0] == run_id]
        for key in keys:
            await self._flush_pending_delta(key)

    async def _flush_pending_delta(self, key: tuple[str, str]) -> None:
        pending = self._pending_deltas.pop(key, None)
        if pending is None:
            return
        if pending.timer:
            pending.timer.cancel()
        if not pending.delta:
            return
        await self._emit_frame(
            source=pending.source,
            event_type=pending.event_type,
            data={"delta": pending.delta},
        )

    def _schedule_flush_task(self, key: tuple[str, str]) -> None:
        task = asyncio.create_task(self._flush_pending_delta(key))
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)


@dataclass(slots=True)
class StreamingRuntime:
    """Provides helpers for forwarding agent events into the SSE hub."""

    hub: EventHub

    def new_source(
        self,
        *,
        agent: str,
        parent_run_id: str | None = None,
        tool_name: str | None = None,
        tool_call_id: str | None = None,
    ) -> EventSource:
        return EventSource(
            agent=agent,
            run_id=new_run_id(agent),
            parent_run_id=parent_run_id,
            tool_name=tool_name,
            tool_call_id=tool_call_id,
        )

    async def stream_agent(
        self,
        source: EventSource,
        events: AsyncIterator[AgentEvent],
    ) -> AgentRunResultEvent[Any]:
        result_event: AgentRunResultEvent[Any] | None = None
        async for event in events:
            await self.hub.publish(source, event)
            if isinstance(event, AgentRunResultEvent):
                result_event = event
        if result_event is None:
            raise RuntimeError("Agent run finished without a result event")
        return result_event


def build_child_summaries(
    recorder: RunRecorder,
    parent_run_id: str,
) -> list[dict[str, Any]]:
    """Return summaries for child runs attached to the parent."""

    return recorder.child_summaries(parent_run_id)

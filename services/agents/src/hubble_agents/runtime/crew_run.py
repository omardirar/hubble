"""CrewAI orchestration with persistence, streaming, and event handling."""

from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from collections.abc import AsyncIterator, Coroutine, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any, cast

from crewai import Crew  # type: ignore[import-untyped]
from crewai.events.event_bus import crewai_event_bus  # type: ignore[import-untyped]
from crewai.events.event_listener import EventListener  # type: ignore[import-untyped]
from crewai.events.types.crew_events import (  # type: ignore[import-untyped]
    CrewKickoffCompletedEvent,
    CrewKickoffFailedEvent,
    CrewKickoffStartedEvent,
)
from crewai.events.types.llm_events import (  # type: ignore[import-untyped]
    LLMCallCompletedEvent,
    LLMStreamChunkEvent,
)
from crewai.events.types.reasoning_events import (  # type: ignore[import-untyped]
    AgentReasoningCompletedEvent,
    AgentReasoningFailedEvent,
    AgentReasoningStartedEvent,
)
from crewai.events.types.task_events import (  # type: ignore[import-untyped]
    TaskCompletedEvent,
    TaskFailedEvent,
    TaskStartedEvent,
)
from crewai.events.types.tool_usage_events import (  # type: ignore[import-untyped]
    ToolUsageErrorEvent,
    ToolUsageFinishedEvent,
    ToolUsageStartedEvent,
)
from opentelemetry import trace
from opentelemetry.trace import SpanKind
from opentelemetry.trace.status import Status, StatusCode

from ..middleware.auth import ServiceTokenPayload
from ..models import ChatRequest
from ..persistence.repository import ChatRepository, ConversationContext, context_from_request
from ..utils import build_assistant_blocks, build_user_blocks

StreamQueue = asyncio.Queue["StreamEvent | None"]

crewai_event_bus = cast(Any, crewai_event_bus)


@dataclass(slots=True)
class StreamEvent:
    """Event delivered to streaming clients via SSE."""

    type: str
    data: dict[str, Any]

    def as_sse(self) -> dict[str, str]:
        """Return a payload compatible with EventSourceResponse."""

        return {"event": self.type, "data": json.dumps(self.data)}


@dataclass(slots=True)
class CrewRunOutcome:
    """Outcome of a crew run."""

    status: str
    summary: str
    actions: list[str]
    raw: str | None
    tokens: int | None
    error: Exception | None = None


def _ensure_uuid(value: uuid.UUID | str) -> str:
    return str(value if isinstance(value, uuid.UUID) else uuid.UUID(str(value)))


class StreamingEventListener:
    """Bridges CrewAI events to persistence and stream queue."""

    def __init__(
        self,
        *,
        loop: asyncio.AbstractEventLoop,
        queue: StreamQueue | None,
        repository: ChatRepository,
        ctx: ConversationContext,
        crew_run_id: uuid.UUID,
        assistant_message_id: uuid.UUID,
        assistant_seq: int,
    ) -> None:
        self._loop = loop
        self._queue = queue
        self._repo = repository
        self._ctx = ctx
        self._crew_run_id = crew_run_id
        self._assistant_message_id = assistant_message_id
        self._assistant_seq = assistant_seq
        self._assistant_text: list[str] = []
        self._task_runs: dict[str, uuid.UUID] = {}
        self._pending: set[asyncio.Task[Any]] = set()
        self._last_task_run_id: uuid.UUID | None = None
        self._model_name: str | None = None
        self._agent_metadata: dict[str, dict[str, Any]] = {}
        self._task_metadata: dict[str, dict[str, Any]] = {}

    def attach(self) -> None:
        """Register event handlers with the CrewAI event bus."""

        @crewai_event_bus.on(CrewKickoffStartedEvent)  # type: ignore[misc]
        def _run_started(_source: Any, event: CrewKickoffStartedEvent) -> None:
            self._emit(
                "run_started",
                {
                    "crew_run_id": _ensure_uuid(self._crew_run_id),
                    "inputs": event.inputs or {},
                },
            )

        @crewai_event_bus.on(TaskStartedEvent)  # type: ignore[misc]
        def _task_started(source: Any, event: TaskStartedEvent) -> None:
            task = getattr(event, "task", None) or source
            self._schedule(self._handle_task_started(task))

        @crewai_event_bus.on(TaskCompletedEvent)  # type: ignore[misc]
        def _task_completed(source: Any, event: TaskCompletedEvent) -> None:
            task = getattr(event, "task", None) or source
            self._schedule(self._handle_task_completed(task, event))

        @crewai_event_bus.on(TaskFailedEvent)  # type: ignore[misc]
        def _task_failed(source: Any, event: TaskFailedEvent) -> None:
            task = getattr(event, "task", None) or source
            self._schedule(self._handle_task_failed(task, event.error))

        @crewai_event_bus.on(LLMStreamChunkEvent)  # type: ignore[misc]
        def _llm_chunk(_source: Any, event: LLMStreamChunkEvent) -> None:
            self._schedule(self._handle_llm_chunk(event))

        @crewai_event_bus.on(LLMCallCompletedEvent)  # type: ignore[misc]
        def _llm_completed(_source: Any, event: LLMCallCompletedEvent) -> None:
            self._schedule(self._handle_llm_completed(event))

        @crewai_event_bus.on(AgentReasoningStartedEvent)  # type: ignore[misc]
        def _reasoning_started(_source: Any, event: AgentReasoningStartedEvent) -> None:
            self._schedule(self._handle_reasoning_event(event, status="started"))

        @crewai_event_bus.on(AgentReasoningCompletedEvent)  # type: ignore[misc]
        def _reasoning_completed(_source: Any, event: AgentReasoningCompletedEvent) -> None:
            self._schedule(self._handle_reasoning_event(event, status="completed"))

        @crewai_event_bus.on(AgentReasoningFailedEvent)  # type: ignore[misc]
        def _reasoning_failed(_source: Any, event: AgentReasoningFailedEvent) -> None:
            self._schedule(self._handle_reasoning_event(event, status="failed"))

        @crewai_event_bus.on(ToolUsageStartedEvent)  # type: ignore[misc]
        def _tool_started(_source: Any, event: ToolUsageStartedEvent) -> None:
            self._schedule(self._handle_tool_started(event))

        @crewai_event_bus.on(ToolUsageFinishedEvent)  # type: ignore[misc]
        def _tool_finished(_source: Any, event: ToolUsageFinishedEvent) -> None:
            self._schedule(self._handle_tool_finished(event))

        @crewai_event_bus.on(ToolUsageErrorEvent)  # type: ignore[misc]
        def _tool_error(_source: Any, event: ToolUsageErrorEvent) -> None:
            self._schedule(self._handle_tool_error(event))

        @crewai_event_bus.on(CrewKickoffCompletedEvent)  # type: ignore[misc]
        def _run_completed(_source: Any, event: CrewKickoffCompletedEvent) -> None:
            self._emit(
                "run_completed",
                {
                    "crew_run_id": _ensure_uuid(self._crew_run_id),
                    "timestamp": event.timestamp.isoformat(),
                },
            )

        @crewai_event_bus.on(CrewKickoffFailedEvent)  # type: ignore[misc]
        def _run_failed(_source: Any, event: CrewKickoffFailedEvent) -> None:
            self._emit(
                "run_failed",
                {
                    "crew_run_id": _ensure_uuid(self._crew_run_id),
                    "error": getattr(event, "error", "Run failed"),
                },
            )

    def _schedule(self, work: Coroutine[Any, Any, Any]) -> None:
        """Ensure coroutine tasks are tracked for graceful shutdown."""

        task: asyncio.Task[Any] = self._loop.create_task(work)
        self._pending.add(task)
        task.add_done_callback(self._pending.discard)

    async def drain(self) -> None:
        """Await all in-flight tasks."""

        if not self._pending:
            return
        await asyncio.gather(*self._pending, return_exceptions=True)

    def _emit(self, event_type: str, payload: Mapping[str, Any]) -> None:
        if self._queue is None:
            return
        event = StreamEvent(type=event_type, data=self._clean_payload(dict(payload)))
        self._loop.call_soon_threadsafe(self._queue.put_nowait, event)

    async def _handle_task_started(self, task: Any) -> None:
        task_id = str(getattr(task, "id", uuid.uuid4()))
        agent = getattr(task, "agent", None)
        agent_role = getattr(agent, "role", None)
        agent_name = agent_role or getattr(agent, "name", None) or "agent"
        agent_id = str(getattr(agent, "id", "")) if agent else ""
        if agent_id:
            self._agent_metadata[agent_id] = {
                "id": agent_id,
                "role": agent_role,
                "name": agent_name,
            }
        task_name = getattr(task, "name", None) or getattr(task, "description", None) or agent_name

        task_run_id = await self._repo.create_task_run(
            self._ctx,
            crew_run_id=self._crew_run_id,
            task_name=task_name,
            agent_name=agent_name,
            prompt_digest=None,
        )
        self._task_runs[task_id] = task_run_id
        self._last_task_run_id = task_run_id
        self._task_metadata[str(task_run_id)] = {
            "task_name": task_name,
            "agent_id": agent_id,
        }

        self._emit(
            "task_started",
            {
                "task_run_id": _ensure_uuid(task_run_id),
                "task_name": task_name,
                "agent_name": agent_name,
                "agent": self._agent_metadata.get(agent_id) if agent_id else None,
            },
        )

    async def _handle_task_completed(self, task: Any, event: TaskCompletedEvent) -> None:
        task_id = str(getattr(task, "id", ""))
        task_run_id = self._task_runs.get(task_id)
        output_text = getattr(event.output, "raw", None)
        task_meta = self._task_metadata.get(str(task_run_id), {}) if task_run_id else {}
        agent_info = self._agent_metadata.get(task_meta.get("agent_id", ""), {})
        if task_run_id:
            await self._repo.complete_task_run(
                task_run_id,
                status="succeeded",
                output_text=output_text,
                artifacts=None,
            )
        self._emit(
            "task_completed",
            {
                "task_run_id": _ensure_uuid(task_run_id or uuid.uuid4()),
                "status": "succeeded",
                "agent": agent_info or None,
                "task": self._task_context(task_run_id),
            },
        )

    async def _handle_task_failed(self, task: Any, error: str) -> None:
        task_id = str(getattr(task, "id", ""))
        task_run_id = self._task_runs.get(task_id)
        task_meta = self._task_metadata.get(str(task_run_id), {}) if task_run_id else {}
        agent_info = self._agent_metadata.get(task_meta.get("agent_id", ""), {})
        if task_run_id:
            await self._repo.complete_task_run(
                task_run_id,
                status="failed",
                output_text=None,
                artifacts={"error": error},
            )
        self._emit(
            "task_completed",
            {
                "task_run_id": _ensure_uuid(task_run_id or uuid.uuid4()),
                "status": "failed",
                "error": error,
                "agent": agent_info or None,
                "task": self._task_context(task_run_id),
            },
        )

    async def _handle_llm_chunk(self, event: LLMStreamChunkEvent) -> None:
        self._assistant_text.append(event.chunk)
        text = "".join(self._assistant_text)
        blocks = build_assistant_blocks(text, [])
        await self._repo.upsert_agent_message(
            self._ctx,
            role="agent",
            seq=self._assistant_seq,
            content_blocks=blocks,
            stream_state="partial",
            message_id=self._assistant_message_id,
            author_user_id=None,
        )

        task_run_id = self._resolve_task_run_id(event)
        agent_info = self._agent_context(event)
        task_context = self._task_context(task_run_id)
        if task_run_id:
            await self._repo.log_agent_event(
                self._ctx,
                task_run_id=task_run_id,
                kind="llm_token",
                payload={
                    "chunk": event.chunk,
                    "agent": agent_info,
                    "task": task_context,
                },
                span_id=None,
            )
        self._emit(
            "message_delta",
            {
                "message_id": _ensure_uuid(self._assistant_message_id),
                "delta": event.chunk,
                "agent": agent_info or None,
                "task": task_context or None,
            },
        )

    async def _handle_llm_completed(self, event: LLMCallCompletedEvent) -> None:
        task_run_id = self._resolve_task_run_id(event)
        agent_info = self._agent_context(event)
        task_context = self._task_context(task_run_id)
        if task_run_id:
            await self._repo.log_agent_event(
                self._ctx,
                task_run_id=task_run_id,
                kind="llm_message",
                payload={
                    "model": event.model,
                    "response": getattr(event, "response", None),
                    "agent": agent_info,
                    "task": task_context,
                },
                span_id=None,
            )
        if getattr(event, "model", None):
            self._model_name = event.model

    async def _handle_tool_started(self, event: ToolUsageStartedEvent) -> None:
        task_run_id = self._resolve_task_run_id(event)
        task_context = self._task_context(task_run_id)
        if task_run_id:
            await self._repo.log_agent_event(
                self._ctx,
                task_run_id=task_run_id,
                kind="tool_call",
                payload={
                    "tool_name": event.tool_name,
                    "tool_args": event.tool_args,
                    "task": task_context,
                },
                span_id=None,
            )
        self._emit(
            "tool_started",
            {
                "task_run_id": _ensure_uuid(task_run_id or uuid.uuid4()),
                "tool_name": event.tool_name,
                "task": task_context or None,
            },
        )

    async def _handle_tool_finished(self, event: ToolUsageFinishedEvent) -> None:
        task_run_id = self._resolve_task_run_id(event)
        task_context = self._task_context(task_run_id)
        payload = {
            "tool_name": event.tool_name,
            "output": getattr(event, "output", None),
            "duration_ms": self._milliseconds_between(event.started_at, event.finished_at),
            "from_cache": event.from_cache,
            "task": task_context,
        }
        if task_run_id:
            await self._repo.log_agent_event(
                self._ctx,
                task_run_id=task_run_id,
                kind="tool_result",
                payload=payload,
                span_id=None,
            )
        self._emit(
            "tool_completed",
            {
                "task_run_id": _ensure_uuid(task_run_id or uuid.uuid4()),
                "tool_name": event.tool_name,
            }
            | payload,
        )

    async def _handle_tool_error(self, event: ToolUsageErrorEvent) -> None:
        task_run_id = self._resolve_task_run_id(event)
        task_context = self._task_context(task_run_id)
        if task_run_id:
            await self._repo.log_agent_event(
                self._ctx,
                task_run_id=task_run_id,
                kind="error",
                payload={
                    "tool_name": event.tool_name,
                    "error": str(event.error),
                    "task": task_context,
                },
                span_id=None,
            )
        self._emit(
            "tool_error",
            {
                "task_run_id": _ensure_uuid(task_run_id or uuid.uuid4()),
                "tool_name": event.tool_name,
                "error": str(event.error),
                "task": task_context or None,
            },
        )

    async def finalize_success(self, summary: str, actions: list[str]) -> None:
        blocks = build_assistant_blocks(summary, actions)
        await self._repo.upsert_agent_message(
            self._ctx,
            role="agent",
            seq=self._assistant_seq,
            content_blocks=blocks,
            stream_state="complete",
            message_id=self._assistant_message_id,
            author_user_id=None,
        )
        self._emit(
            "message_completed",
            {
                "message_id": _ensure_uuid(self._assistant_message_id),
                "summary": summary,
                "actions": actions,
            },
        )

    async def finalize_failure(self, error_message: str) -> None:
        blocks = build_assistant_blocks(error_message, [])
        await self._repo.upsert_agent_message(
            self._ctx,
            role="agent",
            seq=self._assistant_seq,
            content_blocks=blocks,
            stream_state="complete",
            message_id=self._assistant_message_id,
            author_user_id=None,
        )
        self._emit(
            "message_completed",
            {
                "message_id": _ensure_uuid(self._assistant_message_id),
                "summary": error_message,
                "actions": [],
            },
        )

    async def _handle_reasoning_event(self, event: Any, *, status: str) -> None:
        task_run_id = self._resolve_task_run_id(event)
        agent_info = self._agent_context(event)
        task_context = self._task_context(task_run_id)
        payload = self._clean_payload(
            {
                "status": status,
                "agent": agent_info or None,
                "task": task_context or None,
                "trace": getattr(event, "trace", None),
                "steps": getattr(event, "steps", None),
                "analysis": getattr(event, "analysis", None),
                "output": getattr(event, "output", None),
                "error": getattr(event, "error", None) if status == "failed" else None,
            }
        )

        if task_run_id:
            await self._repo.log_agent_event(
                self._ctx,
                task_run_id=task_run_id,
                kind="reasoning",
                payload=payload,
                span_id=None,
            )

        self._emit(f"reasoning_{status}", payload)

    def _agent_context(self, event: Any) -> dict[str, Any]:
        agent_id = getattr(event, "agent_id", None)
        if agent_id is None:
            return {}
        meta = self._agent_metadata.get(str(agent_id))
        if meta:
            return meta
        return {"id": str(agent_id)}

    def _task_context(self, task_run_id: uuid.UUID | None) -> dict[str, Any]:
        if task_run_id is None:
            return {}
        meta = self._task_metadata.get(str(task_run_id), {})
        context: dict[str, Any] = {"task_run_id": _ensure_uuid(task_run_id)}
        if meta.get("task_name"):
            context["task_name"] = meta["task_name"]
        if meta.get("agent_id"):
            context["agent_id"] = meta["agent_id"]
        return context

    @staticmethod
    def _clean_payload(payload: dict[str, Any]) -> dict[str, Any]:
        return {key: value for key, value in payload.items() if value not in (None, {}, [])}

    def _resolve_task_run_id(self, event: Any) -> uuid.UUID | None:
        task_id = getattr(event, "task_id", None)
        if task_id and str(task_id) in self._task_runs:
            return self._task_runs[str(task_id)]
        from_task = getattr(event, "from_task", None)
        candidate_id = getattr(from_task, "id", None)
        if candidate_id and str(candidate_id) in self._task_runs:
            return self._task_runs[str(candidate_id)]
        return self._last_task_run_id

    @staticmethod
    def _milliseconds_between(start: datetime | None, end: datetime | None) -> float | None:
        if not start or not end:
            return None
        delta = end - start
        return delta.total_seconds() * 1000

    @property
    def model_name(self) -> str | None:
        return self._model_name


class CrewRunSession:
    """Encapsulates a single crew execution."""

    def __init__(
        self,
        *,
        crew: Crew,
        repository: ChatRepository,
        ctx: ConversationContext,
        crew_inputs: dict[str, Any],
        crew_run_id: uuid.UUID,
        assistant_message_id: uuid.UUID,
        assistant_seq: int,
        queue: StreamQueue | None,
    ) -> None:
        self._crew = crew
        self._repo = repository
        self._ctx = ctx
        self._crew_inputs = crew_inputs
        self._crew_run_id = crew_run_id
        self._assistant_message_id = assistant_message_id
        self._assistant_seq = assistant_seq
        self._queue = queue
        self._listener: StreamingEventListener | None = None
        self._outcome: CrewRunOutcome | None = None

    async def run(self) -> CrewRunOutcome:
        """Execute the run without streaming."""

        await self._prepare_listener()
        outcome = await self._execute()
        await self._cleanup()
        return outcome

    async def stream(self) -> AsyncIterator[StreamEvent]:
        """Execute the run and yield streaming events."""

        if self._queue is None:
            raise RuntimeError("Streaming queue not initialised")

        loop = asyncio.get_running_loop()
        await self._prepare_listener(loop=loop)

        run_task = asyncio.create_task(self._execute())

        try:
            while True:
                event = await self._queue.get()
                if event is None:
                    break
                yield event
        finally:
            try:
                self._outcome = await run_task
            except Exception as exc:  # pragma: no cover - defensive
                self._outcome = CrewRunOutcome(
                    status="failed",
                    summary="",
                    actions=[],
                    raw=None,
                    tokens=None,
                    error=exc,
                )
            await self._cleanup()

    @property
    def outcome(self) -> CrewRunOutcome | None:
        return self._outcome

    async def _prepare_listener(self, loop: asyncio.AbstractEventLoop | None = None) -> None:
        if self._listener is not None:
            return
        loop = loop or asyncio.get_running_loop()
        self._listener = StreamingEventListener(
            loop=loop,
            queue=self._queue,
            repository=self._repo,
            ctx=self._ctx,
            crew_run_id=self._crew_run_id,
            assistant_message_id=self._assistant_message_id,
            assistant_seq=self._assistant_seq,
        )

    async def _execute(self) -> CrewRunOutcome:
        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span("crew.run", kind=SpanKind.INTERNAL) as span:
            span.set_attribute("crew.run.id", _ensure_uuid(self._crew_run_id))
            span.set_attribute("org.id", _ensure_uuid(self._ctx.org_id))
            span.set_attribute("conversation.id", _ensure_uuid(self._ctx.conversation_id))
            if self._ctx.user_id:
                span.set_attribute("user.id", _ensure_uuid(self._ctx.user_id))

            try:
                with crewai_event_bus.scoped_handlers():
                    # Re-register default telemetry listener plus our streaming listener.
                    EventListener().setup_listeners(crewai_event_bus)
                    if self._listener is None:
                        raise RuntimeError("Streaming listener not initialised")
                    self._listener.attach()
                    crew_output = await self._crew.kickoff_async(inputs=self._crew_inputs)
            except Exception as exc:  # pragma: no cover - defensive
                span.record_exception(exc)
                span.set_status(Status(StatusCode.ERROR, str(exc)))
                if self._listener:
                    await self._listener.finalize_failure(str(exc))
                    await self._listener.drain()
                await self._repo.complete_crew_run(
                    self._crew_run_id,
                    status="failed",
                    usage=None,
                    trace_url=None,
                    error={"detail": str(exc)},
                )
                if self._queue is not None:
                    await self._queue.put(
                        StreamEvent(
                            type="run_failed",
                            data={
                                "crew_run_id": _ensure_uuid(self._crew_run_id),
                                "error": str(exc),
                            },
                        )
                    )
                    await self._queue.put(None)
                raise

        final_output = crew_output.tasks_output[-1] if crew_output.tasks_output else None
        structured = getattr(final_output, "pydantic", None)
        summary = structured.summary if structured else (crew_output.raw or "")
        actions = structured.actions if structured else []
        tokens = getattr(crew_output.token_usage, "total_tokens", None)

        if self._listener:
            model_name = self._listener.model_name
            if model_name:
                span.set_attribute("gen_ai.request.model", model_name)
        span.set_attribute("gen_ai.usage.total_tokens", tokens or 0)
        span.set_attribute("gen_ai.usage.input_tokens", crew_output.token_usage.prompt_tokens)
        span.set_attribute("gen_ai.usage.output_tokens", crew_output.token_usage.completion_tokens)
        span.set_attribute(
            "gen_ai.usage.successful_requests", crew_output.token_usage.successful_requests
        )

        if self._listener:
            await self._listener.finalize_success(summary, actions)
            await self._listener.drain()

        await self._repo.complete_crew_run(
            self._crew_run_id,
            status="succeeded",
            usage={"total_tokens": tokens} if tokens is not None else None,
            trace_url=None,
            error=None,
        )

        if self._queue is not None:
            await self._queue.put(
                StreamEvent(
                    type="run_metrics",
                    data={
                        "crew_run_id": _ensure_uuid(self._crew_run_id),
                        "tokens": tokens,
                    },
                )
            )
            await self._queue.put(None)

        outcome = CrewRunOutcome(
            status="succeeded",
            summary=summary,
            actions=actions,
            raw=crew_output.raw,
            tokens=tokens,
            error=None,
        )
        self._outcome = outcome
        return outcome

    async def _cleanup(self) -> None:
        if self._queue is not None:
            while not self._queue.empty():
                self._queue.get_nowait()
        if self._listener:
            await self._listener.drain()


class CrewRunService:
    """High-level orchestration entry point used by FastAPI endpoints."""

    def __init__(self, crew_factory: Any, repository: ChatRepository) -> None:
        self._crew_factory = crew_factory
        self._repository = repository

    async def run(
        self,
        request: ChatRequest,
        current_user: ServiceTokenPayload,
    ) -> CrewRunOutcome:
        session = await self._build_session(request, current_user, stream=False)
        return await session.run()

    async def stream(
        self,
        request: ChatRequest,
        current_user: ServiceTokenPayload,
    ) -> tuple[CrewRunSession, AsyncIterator[StreamEvent]]:
        queue: StreamQueue = asyncio.Queue()
        session = await self._build_session(request, current_user, stream=True, queue=queue)

        async def iterator() -> AsyncIterator[StreamEvent]:
            async for event in session.stream():
                yield event

        return session, iterator()

    async def _build_session(
        self,
        request: ChatRequest,
        current_user: ServiceTokenPayload,
        *,
        stream: bool,
        queue: StreamQueue | None = None,
    ) -> CrewRunSession:
        ctx = context_from_request(request.model_dump())
        await self._repository.ensure_conversation(
            ctx,
            metadata={"source": "api"},
        )

        user_prompt = request.messages[-1].content
        user_blocks = build_user_blocks(user_prompt)
        message_hash = hashlib.sha256(user_prompt.encode("utf-8")).hexdigest()
        _, user_seq = await self._repository.insert_user_message(
            ctx,
            content_blocks=user_blocks,
            message_hash=message_hash,
        )

        crew_inputs = {
            "user_prompt": user_prompt,
            "org_id": request.org_id,
            "user_id": request.user_id,
            "conversation_id": request.conversation_id,
        }

        crew_run_id = await self._repository.create_crew_run(
            ctx,
            crew_name="authenticated_support",
            input_payload=crew_inputs,
            triggered_by=ctx.user_id,
        )

        assistant_seq = user_seq + 1
        assistant_blocks = build_assistant_blocks("", [])
        assistant_message_id = await self._repository.upsert_agent_message(
            ctx,
            role="agent",
            seq=assistant_seq,
            content_blocks=assistant_blocks,
            stream_state="partial",
            message_id=None,
            author_user_id=None,
        )

        crew = self._crew_factory.crew()

        queue_to_use = queue if stream else None
        if queue_to_use is not None:
            await queue_to_use.put(
                StreamEvent(
                    type="message_started",
                    data={
                        "message_id": _ensure_uuid(assistant_message_id),
                        "seq": assistant_seq,
                    },
                )
            )

        return CrewRunSession(
            crew=crew,
            repository=self._repository,
            ctx=ctx,
            crew_inputs=crew_inputs,
            crew_run_id=crew_run_id,
            assistant_message_id=assistant_message_id,
            assistant_seq=assistant_seq,
            queue=queue_to_use,
        )


__all__ = ["CrewRunOutcome", "CrewRunService", "StreamEvent"]

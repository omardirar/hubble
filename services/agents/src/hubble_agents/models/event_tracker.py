"""Event tracking model for comprehensive agent workflow observability"""

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from time import monotonic
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .stream_aggregator import StreamAggregator

from pydantic_ai.run import AgentRunResult

from .response_schema import (
    AgentRunCompletedData,
    AgentRunStartedData,
    ErrorInfo,
    EventRecord,
    EventType,
    McpRequestCompletedData,
    ToolCallCompletedData,
    UsageDetails,
    WorkflowCancelledData,
    WorkflowCompleteData,
    create_error_info,
    create_failed_event_data,
    create_text_completed_data,
    create_thinking_completed_data,
    create_workflow_start_data,
)


@dataclass
class WorkflowEvent:
    """Individual event in the workflow timeline"""

    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    insertion_index: int = 0  # For deterministic tie-break ordering
    event_type: EventType = EventType.WORKFLOW_START
    agent: str = ""
    content: str = ""
    metadata: Any = None  # Store EventData models directly
    parent_event_id: str | None = None
    token_usage: dict[str, Any] | None = None


@dataclass
class EventTracker:
    """Shared event tracker for all agents in the workflow with aggregation support"""

    events: list[WorkflowEvent] = field(default_factory=list)
    delta_buffers: dict[str, str] = field(default_factory=dict)  # event_id -> accumulated_content
    _correlation_ids: dict[str, str] = field(
        default_factory=dict
    )  # start_event_id -> correlation_id
    _completed_events: set[str] = field(default_factory=set)  # Track completed event IDs
    _truncated_buffers: set[str] = field(default_factory=set)  # Track truncated event IDs
    _active_thinking_metadata: dict[str, dict[str, Any]] = field(
        default_factory=dict
    )  # event_id -> metadata
    _active_text_metadata: dict[str, dict[str, Any]] = field(
        default_factory=dict
    )  # event_id -> metadata
    max_buffer_chars: int = 20000
    global_buffer_cap: int = 1_000_000  # Global memory pressure limit
    workflow_start_emitted: bool = False  # Track single workflow_start per run
    workflow_start_attempts: int = 0  # Track duplicate attempts
    event_sequence: int = 0  # Monotonic sequence counter (for debugging)
    started_count: int = 0  # Buffer lifecycle tracking
    completed_count: int = 0
    failed_count: int = 0
    flushed_count: int = 0
    _insertion_counter: int = 0  # For deterministic ordering
    _write_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    stream_aggregator: "StreamAggregator | None" = None
    agent_results: dict[str, AgentRunResult[Any]] = field(default_factory=dict)
    _mcp_request_payloads: dict[str, dict[str, Any]] = field(default_factory=dict)
    broker: Any = None  # EventStreamBroker (avoid circular import)
    _background_tasks: set[asyncio.Task[Any]] = field(default_factory=set)

    def add_event(
        self,
        event_type: EventType,
        agent: str,
        content: str,
        metadata: Any | None = None,
        parent_event_id: str | None = None,
        token_usage: dict[str, Any] | None = None,
        event_id: str | None = None,
        timestamp: float | None = None,
    ) -> str:
        """Add an event to the timeline and return its ID"""
        # Validate event type
        if not isinstance(event_type, EventType):
            raise TypeError(f"event_type must be EventType enum, got {type(event_type)}")

        # Assign insertion index for deterministic ordering
        insertion_index = self._insertion_counter
        self._insertion_counter += 1

        event = WorkflowEvent(
            event_id=event_id or str(uuid.uuid4()),
            timestamp=timestamp or time.time(),
            event_type=event_type,
            insertion_index=insertion_index,
            agent=agent,
            content=content,
            metadata=metadata,
            parent_event_id=parent_event_id,
            token_usage=token_usage,
        )
        self.events.append(event)
        return event.event_id

    def attach_stream_aggregator(self, aggregator: "StreamAggregator") -> None:
        """Attach stream aggregator for downstream processing."""
        self.stream_aggregator = aggregator

    def get_stream_aggregator(self) -> "StreamAggregator | None":
        """Return attached stream aggregator if present."""
        return self.stream_aggregator

    def record_agent_result(self, agent: str, result: AgentRunResult[Any]) -> None:
        """Record the final AgentRunResult for an agent run."""
        self.agent_results[agent] = result

    def get_agent_result(self, agent: str) -> AgentRunResult[Any] | None:
        """Retrieve recorded AgentRunResult for an agent."""
        return self.agent_results.get(agent)

    def get_events_by_agent(self, agent: str) -> list[WorkflowEvent]:
        """Get all events for a specific agent"""
        return [event for event in self.events if event.agent == agent]

    def get_event_chain(self, event_id: str) -> list[WorkflowEvent]:
        """Get the full chain of events starting from the given event ID"""
        chain: list[WorkflowEvent] = []
        current_id = event_id

        # Find the starting event
        start_event = next((e for e in self.events if e.event_id == current_id), None)
        if not start_event:
            return chain

        chain.append(start_event)

        # Find all child events
        while True:
            child_events = [e for e in self.events if e.parent_event_id == current_id]
            if not child_events:
                break
            # Add all child events at this level
            chain.extend(child_events)
            # Continue with the first child (assuming single chain)
            if child_events:
                current_id = child_events[0].event_id
            else:
                break

        return chain

    def get_agent_summaries(self) -> dict[str, dict[str, Any]]:
        """Calculate per-agent statistics"""
        summaries = {}
        agents = set(event.agent for event in self.events)

        for agent in agents:
            agent_events = self.get_events_by_agent(agent)

            # Calculate token usage
            total_input_tokens = 0
            total_output_tokens = 0
            total_tokens = 0

            for event in agent_events:
                if event.token_usage:
                    total_input_tokens += event.token_usage.get("input_tokens", 0)
                    total_output_tokens += event.token_usage.get("output_tokens", 0)
                    total_tokens += event.token_usage.get("total_tokens", 0)

            # Calculate execution time
            if agent_events:
                start_time = min(event.timestamp for event in agent_events)
                end_time = max(event.timestamp for event in agent_events)
                execution_time_ms = int((end_time - start_time) * 1000)
            else:
                execution_time_ms = 0

            summaries[agent] = {
                "events_count": len(agent_events),
                "total_tokens": total_tokens,
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "execution_time_ms": execution_time_ms,
                "first_event_time": min(event.timestamp for event in agent_events)
                if agent_events
                else 0,
                "last_event_time": max(event.timestamp for event in agent_events)
                if agent_events
                else 0,
            }

        return summaries

    def to_json_serializable(self) -> list[dict[str, Any]]:
        """Convert events to JSON-serializable format"""
        return [
            {
                "event_id": event.event_id,
                "timestamp": event.timestamp,
                "event_type": event.event_type,
                "agent": event.agent,
                "content": event.content,
                "metadata": event.metadata,
                "parent_event_id": event.parent_event_id,
                "token_usage": event.token_usage,
            }
            for event in self.events
        ]

    def add_workflow_start(self, entrypoint: str | None = None) -> str | None:
        """Add single workflow_start event per run"""
        self.workflow_start_attempts += 1

        if self.workflow_start_emitted:
            # Log warning for duplicate attempt but don't fail
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(
                f"Duplicate workflow_start attempt (#{self.workflow_start_attempts}) - ignoring"
            )
            return None  # Already emitted

        self.workflow_start_emitted = True

        # Create workflow start data
        event_data = create_workflow_start_data(entrypoint)

        return self.add_event(
            event_type=EventType.WORKFLOW_START,
            agent="system",
            content="Workflow started",
            metadata=event_data,
        )

    def add_agent_run_started(self, agent: str) -> str:
        """Add agent_run_started event"""
        self.event_sequence += 1

        return self.add_event(
            event_type=EventType.AGENT_RUN_STARTED,
            agent=agent,
            content=f"Agent {agent} started",
            metadata=AgentRunStartedData(),
        )

    def add_agent_run_completed(self, agent: str) -> str:
        """Add agent_run_completed event"""
        self.event_sequence += 1

        return self.add_event(
            event_type=EventType.AGENT_RUN_COMPLETED,
            agent=agent,
            content=f"Agent {agent} completed",
            metadata=AgentRunCompletedData(),
        )

    def add_workflow_complete(self, status: str, total_events: int) -> str:
        """Add workflow_complete event"""
        self.event_sequence += 1

        return self.add_event(
            event_type=EventType.WORKFLOW_COMPLETE,
            agent="system",
            content="Workflow completed",
            metadata=WorkflowCompleteData(status=status, total_events=total_events),
        )

    def add_workflow_cancelled(
        self,
        error: ErrorInfo,
        workflow_stage: str | None = None,
        run_id: str | None = None,
    ) -> str:
        """Add workflow_cancelled event"""
        self.event_sequence += 1

        data = WorkflowCancelledData(error=error, workflow_stage=workflow_stage, run_id=run_id)

        return self.add_event(
            event_type=EventType.WORKFLOW_CANCELLED,
            agent="system",
            content=f"Workflow cancelled: {error.message}",
            metadata=data,
        )

    # New aggregation methods for v1.3+ schema
    def start_thinking(
        self,
        agent: str,
        model_name: str,
        provider_name: str,
        provider_request_id: str | None = None,
    ) -> str:
        """Start thinking aggregation and return event_id"""
        event_id = str(uuid.uuid4())
        start_time_monotonic = monotonic()

        self.delta_buffers[event_id] = ""
        self.started_count += 1

        # Store metadata for duration calculation and provider info
        self._active_thinking_metadata[event_id] = {
            "agent": agent,
            "model_name": model_name,
            "provider_name": provider_name,
            "provider_request_id": provider_request_id,
            "start_time_monotonic": start_time_monotonic,
        }

        # Create internal start data
        from .response_schema import ThinkingStartedData

        event_data = ThinkingStartedData(
            model_name=model_name,
            provider_name=provider_name,
            provider_request_id=provider_request_id,
        )

        self.add_event(
            event_type=EventType.THINKING_STARTED,
            agent=agent,
            content=f"Thinking started with {model_name}",
            metadata=event_data,
            event_id=event_id,
        )
        return event_id

    def add_thinking_delta(self, event_id: str, delta: str) -> None:
        """Add thinking delta with overflow protection and broker publishing"""
        # Check if already truncated - refuse further appends
        if event_id in self._truncated_buffers:
            return

        if event_id not in self.delta_buffers:
            self.delta_buffers[event_id] = ""

        current_content = self.delta_buffers[event_id]

        # Publish delta to broker for real-time streaming (Phase 3B)
        if self.broker and delta:
            agent = self._active_thinking_metadata.get(event_id, {}).get("agent", "unknown")
            # Schedule async publish without blocking
            task = asyncio.create_task(
                self.broker.publish_delta("thinking_delta", agent, delta, event_id)
            )
            # Store reference to prevent garbage collection
            self._background_tasks.add(task)
            task.add_done_callback(self._background_tasks.discard)

        if len(current_content) + len(delta) > self.max_buffer_chars:
            # Truncate with marker and mark as truncated
            remaining_chars = self.max_buffer_chars - len(current_content)
            if remaining_chars > 0:
                self.delta_buffers[event_id] = (
                    current_content + delta[:remaining_chars] + "...[truncated at 20000 chars]"
                )
            else:
                self.delta_buffers[event_id] = current_content + "...[truncated at 20000 chars]"
            self._truncated_buffers.add(event_id)
        else:
            self.delta_buffers[event_id] = current_content + delta

    def complete_thinking(
        self,
        event_id: str,
        usage: UsageDetails | None = None,
        provider_response_id: str | None = None,
        finish_reason: str = "unknown",
    ) -> str | None:
        """Complete thinking and emit thinking_completed event"""
        # Get stored metadata
        metadata = self._active_thinking_metadata.pop(event_id, {})

        # Check for orphan completion
        if not metadata:
            raise ValueError(
                f"Orphan thinking completion for event_id {event_id} - no corresponding start found"
            )

        # Check for duplicate completion
        if event_id in self._completed_events:
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Duplicate thinking completion for event_id {event_id} - ignoring")
            return None

        # Calculate duration using monotonic time (for potential future use)
        start_time_monotonic = metadata["start_time_monotonic"]
        _duration_ms = int((monotonic() - start_time_monotonic) * 1000)

        content = self.delta_buffers.pop(event_id, "")
        self._completed_events.add(event_id)
        self.completed_count += 1

        # Check if truncated
        truncated = event_id in self._truncated_buffers

        # Create discriminated union data
        event_data = create_thinking_completed_data(
            content=content,
            model_name=metadata["model_name"],
            provider_name=metadata["provider_name"],
            provider_request_id=metadata.get("provider_request_id"),
            provider_response_id=provider_response_id,
            finish_reason=finish_reason,
            truncated=truncated,
            parent_event_id=event_id,
            usage=usage,
        )

        return self.add_event(
            event_type=EventType.THINKING_COMPLETED,
            agent=metadata["agent"],
            content=content,
            metadata=event_data,
            parent_event_id=event_id,
            event_id=event_id,
        )

    def fail_thinking(
        self, event_id: str, error: ErrorInfo, provider_response_id: str | None = None
    ) -> str | None:
        """Fail thinking and emit thinking_failed event with partial content"""
        # Get stored metadata
        metadata = self._active_thinking_metadata.pop(event_id, {})

        # Check for orphan completion
        if not metadata:
            raise ValueError(
                f"Orphan thinking failure for event_id {event_id} - no corresponding start found"
            )

        # Check for duplicate completion
        if event_id in self._completed_events:
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Duplicate thinking failure for event_id {event_id} - ignoring")
            return None

        content = self.delta_buffers.pop(event_id, "")
        self._completed_events.add(event_id)
        self.failed_count += 1

        # Create failed event data with parent link
        event_data = create_failed_event_data(error)

        return self.add_event(
            event_type=EventType.THINKING_FAILED,
            agent=metadata["agent"],
            content=content,
            metadata=event_data,
            parent_event_id=event_id,
            event_id=event_id,
        )

    def start_text(self, agent: str) -> str:
        """Start text aggregation and return event_id"""
        event_id = str(uuid.uuid4())
        self.delta_buffers[event_id] = ""
        self._active_text_metadata[event_id] = {"agent": agent}
        self.started_count += 1
        return event_id

    def add_text_delta(self, event_id: str, delta: str) -> None:
        """Add text delta with overflow protection and broker publishing"""
        if event_id not in self.delta_buffers:
            self.delta_buffers[event_id] = ""

        current_content = self.delta_buffers[event_id]

        # Publish delta to broker for real-time streaming
        if self.broker and delta:
            agent = self._active_text_metadata.get(event_id, {}).get("agent", "unknown")
            # Schedule async publish without blocking
            task = asyncio.create_task(
                self.broker.publish_delta("text_delta", agent, delta, event_id)
            )
            # Store reference to prevent garbage collection
            self._background_tasks.add(task)
            task.add_done_callback(self._background_tasks.discard)

        if len(current_content) + len(delta) > self.max_buffer_chars:
            # Truncate with marker
            remaining_chars = self.max_buffer_chars - len(current_content)
            if remaining_chars > 0:
                self.delta_buffers[event_id] = (
                    current_content + delta[:remaining_chars] + "...[truncated at 20000 chars]"
                )
            else:
                self.delta_buffers[event_id] = current_content + "...[truncated at 20000 chars]"
        else:
            self.delta_buffers[event_id] = current_content + delta

    def complete_text(
        self,
        event_id: str,
        agent: str,
        usage: UsageDetails | None = None,
        provider_request_id: str | None = None,
        provider_response_id: str | None = None,
        model_name: str | None = None,
        provider_name: str | None = None,
    ) -> str | None:
        """Complete text and emit text_completed event"""
        content = self.delta_buffers.pop(event_id, "")
        self.event_sequence += 1
        self._active_text_metadata.pop(event_id, None)

        # Create discriminated union data
        event_data = create_text_completed_data(
            content=content,
            model_name=model_name or "unknown",
            provider_name=provider_name or "unknown",
            provider_request_id=provider_request_id,
            provider_response_id=provider_response_id,
            usage=usage,
        )

        return self.add_event(
            event_type=EventType.TEXT_COMPLETED,
            agent=agent,
            content=content,
            metadata=event_data,
            event_id=event_id,
        )

    def fail_text(
        self,
        event_id: str,
        agent: str,
        error: ErrorInfo,
        provider_request_id: str | None = None,
        provider_response_id: str | None = None,
        model_name: str | None = None,
        provider_name: str | None = None,
    ) -> str | None:
        """Fail text and emit text_failed event with partial content"""
        content = self.delta_buffers.pop(event_id, "")
        self._active_text_metadata.pop(event_id, None)

        event_data = create_failed_event_data(error)

        return self.add_event(
            event_type=EventType.TEXT_FAILED,
            agent=agent,
            content=content,
            metadata=event_data,
            event_id=event_id,
        )

    def start_tool_call(self, agent: str, tool_name: str, args: dict[str, Any]) -> tuple[str, str]:
        """Start tool call and return (event_id, tool_call_id)"""
        event_id = str(uuid.uuid4())
        tool_call_id = str(uuid.uuid4())  # Stable correlation ID

        # Store correlation mapping
        self._correlation_ids[event_id] = tool_call_id

        self.delta_buffers[event_id] = ""
        self.started_count += 1

        # Create internal start data
        from .response_schema import ToolCallStartedData

        event_data = ToolCallStartedData(
            tool_kind="function",
            tool_name=tool_name,
            tool_call_id=tool_call_id,
            args=args,
        )

        self.add_event(
            event_type=EventType.TOOL_CALL_STARTED,
            agent=agent,
            content=f"Calling {tool_name}",
            metadata=event_data,
            event_id=event_id,
        )
        return event_id, tool_call_id

    def complete_tool_call(
        self,
        event_id: str,
        agent: str,
        tool_name: str,
        duration_ms: int,
        usage: UsageDetails | None = None,
        response: dict[str, Any] | None = None,
    ) -> str | None:
        """Complete tool call and emit tool_call_completed event"""
        # Check for orphan completion
        if event_id not in self._correlation_ids:
            raise ValueError(
                f"Orphan tool call completion for event_id {event_id} - "
                f"no corresponding start found"
            )

        # Check for duplicate completion
        if event_id in self._completed_events:
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Duplicate tool call completion for event_id {event_id} - ignoring")
            return None

        # Get correlation ID and mark as completed
        tool_call_id = self._correlation_ids[event_id]
        self._correlation_ids.pop(event_id, None)
        self._completed_events.add(event_id)
        self.completed_count += 1

        # Clean up buffer
        self.delta_buffers.pop(event_id, None)

        # Create completion data with correlation ID and parent link
        event_data = ToolCallCompletedData(
            tool_kind="function",
            tool_name=tool_name,
            tool_call_id=tool_call_id,
            duration_ms=duration_ms,
            usage=usage,
            result=response,
        )

        return self.add_event(
            event_type=EventType.TOOL_CALL_COMPLETED,
            agent=agent,
            content=f"Tool {tool_name} completed",
            metadata=event_data,
            parent_event_id=event_id,
            event_id=event_id,
        )

    def fail_tool_call(
        self,
        event_id: str,
        agent: str,
        tool_name: str,
        error: ErrorInfo,
        duration_ms: int | None = None,
    ) -> str:
        """Fail tool call and emit tool_call_failed event"""
        self.delta_buffers.pop(event_id, None)  # Clean up buffer
        self._correlation_ids.pop(event_id, None)
        self.failed_count += 1

        event_data = create_failed_event_data(error)

        return self.add_event(
            event_type=EventType.TOOL_CALL_FAILED,
            agent=agent,
            content=f"Tool {tool_name} failed: {error.message}",
            metadata=event_data,
            event_id=event_id,
        )

    def start_mcp_request(
        self,
        agent: str,
        server: str,
        tool_name: str,
        args: dict[str, Any],
        session_id: str,
    ) -> tuple[str, str]:
        """Start MCP request and return (event_id, mcp_request_id)"""
        event_id = str(uuid.uuid4())
        mcp_request_id = str(uuid.uuid4())  # Stable correlation ID

        # Store correlation mapping
        self._correlation_ids[event_id] = mcp_request_id

        self.delta_buffers[event_id] = ""
        self.started_count += 1

        # Create internal start data
        from .response_schema import McpRequestStartedData

        event_data = McpRequestStartedData(
            server=server,
            session_id=session_id,
            request={"tool": tool_name, "args": args},
        )

        self.add_event(
            event_type=EventType.MCP_REQUEST_STARTED,
            agent=agent,
            content=f"MCP request to {server}:{tool_name}",
            metadata=event_data,
            event_id=event_id,
        )
        self._mcp_request_payloads[event_id] = {
            "server": server,
            "tool_name": tool_name,
            "args": args,
            "session_id": session_id,
        }
        return event_id, mcp_request_id

    def complete_mcp_request(
        self,
        event_id: str,
        agent: str,
        server: str,
        tool_name: str,
        duration_ms: int,
        response: dict[str, Any],
        media_type: str | None = None,
        usage: UsageDetails | None = None,
        session_id: str | None = None,
    ) -> str | None:
        """Complete MCP request and emit mcp_request_completed event"""
        # Check for orphan completion
        if event_id not in self._correlation_ids:
            raise ValueError(
                f"Orphan MCP request completion for event_id {event_id} - "
                f"no corresponding start found"
            )

        # Check for duplicate completion
        if event_id in self._completed_events:
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Duplicate MCP request completion for event_id {event_id} - ignoring")
            return None

        # Mark as completed
        mcp_request_id = self._correlation_ids.pop(event_id)
        self._completed_events.add(event_id)
        self.completed_count += 1

        # Clean up buffer
        self.delta_buffers.pop(event_id, None)
        request_meta = self._mcp_request_payloads.pop(event_id, {})

        # Handle large payload integrity metadata
        import json

        def _json_bytes(payload: Any) -> bytes:
            try:
                return json.dumps(payload, sort_keys=True).encode("utf-8")
            except Exception:
                return json.dumps(str(payload)).encode("utf-8")

        request_payload = {"tool": tool_name, "args": request_meta.get("args", {})}
        response_payload = response or {}

        request_bytes = _json_bytes(request_payload)
        response_bytes = _json_bytes(response_payload)

        request_size = len(request_bytes)
        response_size = len(response_bytes)

        import hashlib

        request_hash = hashlib.sha256(request_bytes).hexdigest()
        response_hash = hashlib.sha256(response_bytes).hexdigest()

        MAX_PAYLOAD_SIZE = 100_000  # 100KB
        payload_truncated = response_size > MAX_PAYLOAD_SIZE

        # Create completion data with correlation ID and parent link
        media_type_val = media_type

        event_data = McpRequestCompletedData(
            server=server,
            session_id=session_id
            or mcp_request_id,  # Use provided session_id or correlation_id as fallback
            request=request_payload,
            response=response_payload,
            duration_ms=duration_ms,
            usage=usage,
            media_type=str(media_type_val) if media_type_val is not None else None,
            size_bytes=response_size,
            sha256=response_hash,
            request_size_bytes=request_size,
            request_sha256=request_hash,
            response_size_bytes=response_size,
            response_sha256=response_hash,
            payload_truncated=payload_truncated,
        )

        return self.add_event(
            event_type=EventType.MCP_REQUEST_COMPLETED,
            agent=agent,
            content=f"MCP request to {server}:{tool_name} completed",
            metadata=event_data,
            parent_event_id=event_id,
            event_id=event_id,
        )

    def fail_mcp_request(
        self,
        event_id: str,
        agent: str,
        server: str,
        tool_name: str,
        error: ErrorInfo,
        duration_ms: int | None = None,
        session_id: str | None = None,
    ) -> str | None:
        """Fail MCP request and emit mcp_request_failed event"""
        # Check for orphan completion
        if event_id not in self._correlation_ids:
            raise ValueError(
                f"Orphan MCP request failure for event_id {event_id} - no corresponding start found"
            )

        # Check for duplicate completion
        if event_id in self._completed_events:
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Duplicate MCP request failure for event_id {event_id} - ignoring")
            return None

        # Remove correlation ID mapping and mark as completed
        self._correlation_ids.pop(event_id, None)
        self._completed_events.add(event_id)
        self.failed_count += 1

        # Clean up buffer
        self.delta_buffers.pop(event_id, None)

        # Create failed event data with correlation ID and parent link
        event_data = create_failed_event_data(error)

        return self.add_event(
            event_type=EventType.MCP_REQUEST_FAILED,
            agent=agent,
            content=f"MCP request to {server}:{tool_name} failed: {error.message}",
            metadata=event_data,
            parent_event_id=event_id,
            event_id=event_id,
        )

    def flush(self) -> None:
        """MUST emit any buffered content on cancel/failure"""
        import logging

        logger = logging.getLogger(__name__)

        # Check for buffer leaks
        if self.started_count != (
            self.completed_count + self.failed_count + self.flushed_count + len(self.delta_buffers)
        ):
            logger.warning(
                f"Buffer leak detected: started={self.started_count}, "
                f"completed={self.completed_count}, failed={self.failed_count}, "
                f"flushed={self.flushed_count}, remaining={len(self.delta_buffers)}"
            )

        # Emit failed events for all remaining buffers
        for event_id, content in self.delta_buffers.items():
            if content:
                # Determine event type and create appropriate failed event
                if event_id in self._active_thinking_metadata:
                    # Thinking event
                    metadata = self._active_thinking_metadata.pop(event_id, {})
                    error = create_error_info(
                        code="CANCELLED",
                        message="Thinking cancelled with partial content",
                    )
                    event_type = EventType.THINKING_FAILED
                    agent = metadata.get("agent", "system")
                elif event_id in self._active_text_metadata:
                    # Text event
                    metadata = self._active_text_metadata.pop(event_id, {})
                    error = create_error_info(
                        code="CANCELLED",
                        message="Text generation cancelled with partial content",
                    )
                    event_type = EventType.TEXT_FAILED
                    agent = metadata.get("agent", "system")
                else:
                    # Tool or MCP event
                    error = create_error_info(
                        code="CANCELLED", message="Event cancelled with partial content"
                    )
                    event_type = EventType.AGENT_RUN_FAILED
                    agent = "system"

                event_data = create_failed_event_data(error)
                self.flushed_count += 1

                self.add_event(
                    event_type=event_type,
                    agent=agent,
                    content=content,
                    metadata=event_data,
                    parent_event_id=event_id,
                )

        # Clear all buffers and metadata
        self.delta_buffers.clear()
        self._active_thinking_metadata.clear()
        self._active_text_metadata.clear()
        self._truncated_buffers.clear()

    def to_v1_3_events(self) -> list[EventRecord]:
        """
        Convert to v1.3 EventRecord objects with discriminated union data
        (finished-only)
        """
        from ..utils.content_sanitizer import sanitize_content
        from .response_schema import EXPORTED_EVENT_TYPES

        event_records = []
        seq = 0

        # Sort events by timestamp, then by insertion_index for deterministic tie-break
        sorted_events = sorted(self.events, key=lambda e: (e.timestamp, e.insertion_index))

        for event in sorted_events:
            # Skip internal start events (finished-only export)
            if event.event_type in {
                EventType.TOOL_CALL_STARTED,
                EventType.MCP_REQUEST_STARTED,
                EventType.THINKING_STARTED,
                EventType.TEXT_STARTED,
            }:
                continue

            # Convert timestamp to timezone-aware datetime
            ts = datetime.fromtimestamp(event.timestamp, tz=UTC)
            seq += 1

            # Get metadata (stores EventData models directly)
            event_data = event.metadata

            # Sanitize content for non-model events
            content = sanitize_content(event.content) if event.content else None

            # Create EventRecord with finished-only content policy
            event_record = EventRecord(
                id=event.event_id,
                seq=seq,
                ts=ts,
                source={"agent": event.agent},
                type=event.event_type,
                data=event_data,
                content=None
                if event.event_type in [EventType.TEXT_COMPLETED, EventType.THINKING_COMPLETED]
                else content,
                parent_event_id=event.parent_event_id,
            )

            # Validate that only exported types are included
            if event.event_type not in EXPORTED_EVENT_TYPES:
                raise ValueError(
                    f"Non-exported event type {event.event_type} leaked to v1.3 export"
                )

            event_records.append(event_record)

        # Hard assertion: no start events should be exported
        exported_starts = [
            e
            for e in event_records
            if e.type
            in {
                EventType.TOOL_CALL_STARTED,
                EventType.MCP_REQUEST_STARTED,
                EventType.THINKING_STARTED,
                EventType.TEXT_STARTED,
            }
        ]
        if exported_starts:
            leaked_ids = [e.id for e in exported_starts]
            raise AssertionError(f"Internal start events leaked to export: {leaked_ids}")

        return event_records

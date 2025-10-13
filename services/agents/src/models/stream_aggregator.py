"""StreamAggregator for event aggregation with error handling

Aggregates streaming deltas from PydanticAI's event_stream_handler into single,
completed event records. Supports both streaming and non-streaming modes with
uniform storage shape.
"""

from datetime import UTC, datetime
from typing import Any

from ..utils.logging import get_logger
from .event_tracker import EventTracker
from .response_schema import EventType, UsageDetails, create_error_info

logger = get_logger(__name__)


class StreamAggregator:
    """Aggregates streaming deltas into completed events with error handling"""

    def __init__(self, event_tracker: EventTracker, max_buffer_chars: int = 20000):
        self.event_tracker = event_tracker
        self.max_buffer_chars = max_buffer_chars
        self.active_thinking: dict[str, dict[str, Any]] = {}
        self.active_text: dict[str, dict[str, Any]] = {}
        self.active_tool_calls: dict[str, dict[str, Any]] = {}
        self.active_mcp_requests: dict[str, dict[str, Any]] = {}
        self.current_context: str = "supervisor"  # Track current execution context
        attach = getattr(self.event_tracker, "attach_stream_aggregator", None)
        if callable(attach):
            attach(self)

    def _infer_agent(self, event: Any, current_context: str | None = None) -> str:
        """Infer agent name from context"""
        agent = getattr(event, "agent", None)

        if agent and agent != "unknown":
            return str(agent)

        # Infer from current execution context
        # (track internally that this was inferred, but don't serialize the flag)
        if current_context:
            return current_context  # e.g., "analyst_agent" if in delegated run

        # Default to supervisor
        return "supervisor"

    async def handle_event(self, context: Any, stream: Any) -> None:
        """Handle streaming events and aggregate deltas"""
        try:
            # Iterate over the stream of events
            async for event in stream:
                # Handle different event types from PydanticAI
                if hasattr(event, "__class__"):
                    event_class_name = event.__class__.__name__

                    if event_class_name == "PartStartEvent":
                        await self._handle_part_start(event)
                    elif event_class_name == "PartDeltaEvent":
                        await self._handle_part_delta(event)
                    elif event_class_name == "FinalResultEvent":
                        await self._handle_final_result(event)
                    elif event_class_name == "ErrorEvent":
                        await self._handle_error(event)
                    elif event_class_name == "RunStartEvent":
                        await self._handle_run_start(event)
                    elif event_class_name == "RunCompleteEvent":
                        await self._handle_run_complete(event)
                    else:
                        # Handle other event types generically
                        await self._handle_generic_event(event)

        except Exception as e:
            # Log error but don't fail the entire aggregation
            logger.error(f"Error handling event stream: {e}", exc_info=True)

    async def _handle_part_start(self, event: Any) -> None:
        """Handle part start events (thinking, text, tool calls)"""
        try:
            part_type = "unknown"
            part = getattr(event, "part", None)

            # First try to get part type from the part object
            if part and hasattr(part, "type"):
                part_type = part.type
            elif part and hasattr(part, "__class__"):
                # Try to infer from part class name
                part_class = part.__class__.__name__.lower()
                if "thinking" in part_class:
                    part_type = "thinking"
                elif "text" in part_class:
                    part_type = "text"
                elif "tool" in part_class:
                    part_type = "tool_call"

            # If still unknown, try to infer from event class name or other attributes
            if part_type == "unknown":
                event_class = event.__class__.__name__.lower()
                if "thinking" in event_class:
                    part_type = "thinking"
                elif "text" in event_class:
                    part_type = "text"
                elif "tool" in event_class:
                    part_type = "tool_call"
                elif "message" in event_class:
                    part_type = "text"  # Default to text for message events
                else:
                    # Try to infer from event attributes
                    if hasattr(event, "content") and not hasattr(event, "tool_name"):
                        part_type = "text"
                    elif hasattr(event, "tool_name"):
                        part_type = "tool_call"
                    elif hasattr(event, "reasoning"):
                        part_type = "thinking"

            # Extract agent from event context - prefer supervisor for main workflow
            agent = self._infer_agent(event, self.current_context)
            if agent == "unknown":
                agent = "supervisor"

            # Only print if we have meaningful information
            if part_type != "unknown" or agent != "unknown":
                logger.debug(f"Handling part start: {part_type} from {agent}")

            if part_type == "thinking":
                model_name = (
                    getattr(event, "model_name", None) or "claude-sonnet-4-20250514"
                )
                provider_name = getattr(event, "provider_name", None) or "anthropic"
                event_id = self.event_tracker.start_thinking(
                    agent, model_name, provider_name
                )
                self.active_thinking[event_id] = {
                    "agent": agent,
                    "start_time": datetime.now(UTC),
                    "provider_request_id": getattr(event, "provider_request_id", None),
                    "provider_response_id": getattr(
                        event, "provider_response_id", None
                    ),
                    "model_name": model_name,
                    "provider_name": provider_name,
                }

            elif part_type == "text":
                model_name = (
                    getattr(event, "model_name", None) or "claude-sonnet-4-20250514"
                )
                provider_name = getattr(event, "provider_name", None) or "anthropic"
                event_id = self.event_tracker.start_text(agent)
                self.active_text[event_id] = {
                    "agent": agent,
                    "start_time": datetime.now(UTC),
                    "provider_request_id": getattr(event, "provider_request_id", None),
                    "provider_response_id": getattr(
                        event, "provider_response_id", None
                    ),
                    "model_name": model_name,
                    "provider_name": provider_name,
                }

            elif part_type == "tool_call":
                tool_name = getattr(event, "tool_name", "unknown")
                args = getattr(event, "args", {})
                event_id, _ = self.event_tracker.start_tool_call(agent, tool_name, args)
                self.active_tool_calls[event_id] = {
                    "agent": agent,
                    "tool_name": tool_name,
                    "args": args,
                    "start_time": datetime.now(UTC),
                }

        except Exception as e:
            logger.error(f"Error handling part start: {e}", exc_info=True)

    async def _handle_part_delta(self, event: Any) -> None:
        """Handle part delta events (thinking, text deltas)"""
        try:
            part_type = getattr(event, "part", {}).get("type", "")
            delta = getattr(event, "delta", "")
            event_id = getattr(event, "event_id", None)

            if not event_id:
                return

            if part_type == "thinking" and event_id in self.active_thinking:
                self.event_tracker.add_thinking_delta(event_id, delta)

            elif part_type == "text" and event_id in self.active_text:
                self.event_tracker.add_text_delta(event_id, delta)

        except Exception as e:
            logger.error(f"Error handling part delta: {e}", exc_info=True)

    async def _handle_final_result(self, event: Any) -> None:
        """Handle final result events"""
        try:
            part_type = getattr(event, "part", {}).get("type", "")
            event_id = getattr(event, "event_id", None)
            usage = self._extract_usage(event)

            if not event_id:
                return

            if part_type == "thinking" and event_id in self.active_thinking:
                thinking_info = self.active_thinking.pop(event_id)
                duration_ms = int(
                    (datetime.now(UTC) - thinking_info["start_time"]).total_seconds()
                    * 1000
                )

                self.event_tracker.complete_thinking(
                    event_id=event_id,
                    usage=usage,
                    provider_response_id=thinking_info.get("provider_response_id"),
                    finish_reason="stop",
                )

            elif part_type == "text" and event_id in self.active_text:
                text_info = self.active_text.pop(event_id)
                duration_ms = int(
                    (datetime.now(UTC) - text_info["start_time"]).total_seconds() * 1000
                )

                self.event_tracker.complete_text(
                    event_id=event_id,
                    agent=text_info["agent"],
                    usage=usage,
                    provider_request_id=text_info.get("provider_request_id"),
                    provider_response_id=text_info.get("provider_response_id"),
                    model_name=text_info.get("model_name"),
                    provider_name=text_info.get("provider_name"),
                )

            elif part_type == "tool_call" and event_id in self.active_tool_calls:
                tool_info = self.active_tool_calls.pop(event_id)
                duration_ms = int(
                    (datetime.now(UTC) - tool_info["start_time"]).total_seconds() * 1000
                )
                response = getattr(event, "response", {})

                self.event_tracker.complete_tool_call(
                    event_id=event_id,
                    agent=tool_info["agent"],
                    tool_name=tool_info["tool_name"],
                    duration_ms=duration_ms,
                    usage=usage,
                    response=response,
                )

        except Exception as e:
            logger.error(f"Error handling final result: {e}", exc_info=True)

    async def _handle_error(self, event: Any) -> None:
        """Handle error events"""
        try:
            error_code = getattr(event, "error_code", "UNKNOWN_ERROR")
            error_message = getattr(event, "error_message", "Unknown error")
            event_id = getattr(event, "event_id", None)

            error = create_error_info(
                code=error_code,
                message=error_message,
                provider_code=getattr(event, "provider_error_code", None),
            )

            if event_id in self.active_thinking:
                thinking_info = self.active_thinking.pop(event_id)
                self.event_tracker.fail_thinking(
                    event_id=event_id,
                    error=error,
                    provider_response_id=thinking_info.get("provider_response_id"),
                )

            elif event_id in self.active_text:
                text_info = self.active_text.pop(event_id)
                self.event_tracker.fail_text(
                    event_id=event_id,
                    agent=text_info.get("agent", "unknown"),
                    error=error,
                    provider_response_id=text_info.get("provider_response_id"),
                )

            elif event_id in self.active_tool_calls:
                tool_info = self.active_tool_calls.pop(event_id)
                duration_ms = int(
                    (datetime.now(UTC) - tool_info["start_time"]).total_seconds() * 1000
                )

                self.event_tracker.fail_tool_call(
                    event_id=event_id,
                    agent=tool_info["agent"],
                    tool_name=tool_info["tool_name"],
                    error=error,
                    duration_ms=duration_ms,
                )

        except Exception as e:
            logger.error(f"Error handling error event: {e}", exc_info=True)

    async def _handle_run_start(self, event: Any) -> None:
        """Handle run start events"""
        try:
            agent = self._infer_agent(event, self.current_context)
            self.event_tracker.add_agent_run_started(agent)
        except Exception as e:
            logger.error(f"Error handling run start: {e}", exc_info=True)

    async def _handle_run_complete(self, event: Any) -> None:
        """Handle run complete events"""
        try:
            agent = self._infer_agent(event, self.current_context)
            usage = self._extract_usage(event)

            # Extract final text from event
            final_text = getattr(event, "output", "") or getattr(event, "content", "")
            if final_text:
                model_name = getattr(event, "model_name", None)
                provider_name = getattr(event, "provider_name", None)
                provider_request_id = getattr(event, "provider_request_id", None)
                provider_response_id = getattr(event, "provider_response_id", None)

                event_id = self.event_tracker.start_text(agent)
                self.event_tracker.add_text_delta(event_id, str(final_text))
                self.event_tracker.complete_text(
                    event_id=event_id,
                    agent=agent,
                    usage=usage,
                    provider_request_id=provider_request_id,
                    provider_response_id=provider_response_id,
                    model_name=model_name,
                    provider_name=provider_name,
                )

            self.event_tracker.add_agent_run_completed(agent)
        except Exception as e:
            logger.error(f"Error handling run complete: {e}", exc_info=True)

    async def _handle_generic_event(self, event: Any) -> None:
        """Handle generic events"""
        try:
            # Try to extract basic information
            event_type = getattr(event, "event_type", "unknown")
            content = getattr(event, "content", "")
            entrypoint = getattr(event, "entrypoint", None)

            # Map to our event types
            event_type_mapping = {
                "workflow_start": EventType.WORKFLOW_START,
                "workflow_complete": EventType.WORKFLOW_COMPLETE,
                "workflow_cancelled": EventType.WORKFLOW_CANCELLED,
                "workflow_timed_out": EventType.WORKFLOW_TIMED_OUT,
            }

            mapped_type = event_type_mapping.get(event_type, EventType.WORKFLOW_START)

            if mapped_type == EventType.WORKFLOW_START:
                self.event_tracker.add_workflow_start(entrypoint=entrypoint)
            elif mapped_type == EventType.WORKFLOW_COMPLETE:
                status = getattr(event, "status", "succeeded")
                total_events = getattr(
                    event, "total_events", len(self.event_tracker.events)
                )
                self.event_tracker.add_workflow_complete(
                    status=status, total_events=total_events
                )
            elif mapped_type == EventType.WORKFLOW_CANCELLED:
                error = create_error_info(
                    code=getattr(event, "error_code", "UNKNOWN_ERROR"),
                    message=getattr(
                        event, "error_message", content or "Workflow cancelled"
                    ),
                    provider_code=getattr(event, "provider_error_code", None),
                )
                self.event_tracker.add_workflow_cancelled(
                    error=error,
                    workflow_stage=getattr(event, "workflow_stage", None),
                    run_id=getattr(event, "run_id", None),
                )
            elif mapped_type == EventType.WORKFLOW_TIMED_OUT:
                error = create_error_info(
                    code="TIMEOUT", message=content or "Workflow timed out"
                )
                self.event_tracker.add_workflow_cancelled(
                    error=error,
                    workflow_stage=getattr(event, "workflow_stage", None),
                    run_id=getattr(event, "run_id", None),
                )
        except Exception as e:
            logger.error(f"Error handling generic event: {e}", exc_info=True)

    def _extract_usage(self, event: Any) -> UsageDetails | None:
        """Extract usage information from event"""
        try:
            usage_attr = getattr(event, "usage", None)
            if usage_attr is None:
                return None

            # Handle both callable (method) and data (dict/object)
            usage_data = usage_attr() if callable(usage_attr) else usage_attr
            if not usage_data:
                return None

            # Normalize to dict-like access for both dict and object
            def g(x: Any, key: str, default: Any = 0) -> Any:
                return (
                    x.get(key, default)
                    if isinstance(x, dict)
                    else getattr(x, key, default)
                )

            # Ensure details is always a plain dict
            details = g(usage_data, "details", {}) or {}
            if not isinstance(details, dict):
                details = dict(details)

            return UsageDetails(
                input_tokens=g(usage_data, "input_tokens"),
                output_tokens=g(usage_data, "output_tokens"),
                reasoning_tokens=g(usage_data, "reasoning_tokens"),
                cache_write_tokens=g(usage_data, "cache_write_tokens"),
                cache_read_tokens=g(usage_data, "cache_read_tokens"),
                input_audio_tokens=g(usage_data, "input_audio_tokens"),
                cache_audio_read_tokens=g(usage_data, "cache_audio_read_tokens"),
                details=details,
            )
        except Exception as e:
            logger.error(f"Error extracting usage: {e}", exc_info=True)
            return None

    def _resolve_model_provider(self, obj: Any) -> tuple[str, str]:
        """
        Best-effort extraction of model and provider names from
        Pydantic AI objects.
        """
        model_name: str | None = getattr(obj, "model_name", None)
        raw_model = getattr(obj, "model", None)
        if model_name is None and raw_model is not None:
            model_name = getattr(raw_model, "model_name", None) or getattr(
                raw_model, "name", None
            )
            if model_name is None:
                model_name = str(raw_model)
        if model_name is None:
            model_name = "unknown"

        provider_name: str | None = getattr(obj, "provider_name", None)
        raw_provider = getattr(obj, "provider", None)
        if provider_name is None and raw_provider is not None:
            provider_name = getattr(raw_provider, "name", None) or getattr(
                raw_provider, "provider_name", None
            )
            if provider_name is None:
                provider_name = str(raw_provider)
        if provider_name is None:
            provider_name = "unknown"

        return str(model_name), str(provider_name)

    async def flush(self) -> None:
        """MUST emit any buffered content on cancel/failure"""
        # Flush event tracker buffers
        self.event_tracker.flush()

        # Emit any remaining active events as failed
        for event_id, thinking_info in self.active_thinking.items():
            error = create_error_info(
                code="CANCELLED", message="Thinking cancelled with partial content"
            )
            self.event_tracker.fail_thinking(
                event_id=event_id,
                error=error,
                provider_response_id=thinking_info.get("provider_response_id"),
            )

        for event_id, text_info in self.active_text.items():
            error = create_error_info(
                code="CANCELLED",
                message="Text generation cancelled with partial content",
            )
            self.event_tracker.fail_text(
                event_id=event_id,
                agent=text_info["agent"],
                error=error,
                provider_request_id=text_info.get("provider_request_id"),
                provider_response_id=text_info.get("provider_response_id"),
                model_name=text_info.get("model_name"),
                provider_name=text_info.get("provider_name"),
            )

        for event_id, tool_info in self.active_tool_calls.items():
            error = create_error_info(code="CANCELLED", message="Tool call cancelled")
            duration_ms = int(
                (datetime.now(UTC) - tool_info["start_time"]).total_seconds() * 1000
            )
            self.event_tracker.fail_tool_call(
                event_id=event_id,
                agent=tool_info["agent"],
                tool_name=tool_info["tool_name"],
                error=error,
                duration_ms=duration_ms,
            )

        # Clear all active buffers
        self.active_thinking.clear()
        self.active_text.clear()
        self.active_tool_calls.clear()
        self.active_mcp_requests.clear()

    async def synthesize_non_streaming(self, result: Any) -> None:
        """Synthesize completed events for non-streaming runs"""
        try:
            # Extract basic information from result
            agent = self._infer_agent(result, self.current_context)
            usage = self._extract_usage(result)

            # Synthesize thinking_completed if thinking was used
            if hasattr(result, "thinking") and result.thinking:
                thinking_content = str(result.thinking)
                if thinking_content:
                    # Extract model info from result or use defaults
                    model_name, provider_name = self._resolve_model_provider(result)

                    event_id = self.event_tracker.start_thinking(
                        agent, model_name, provider_name
                    )
                    self.event_tracker.add_thinking_delta(event_id, thinking_content)

                    self.event_tracker.complete_thinking(
                        event_id=event_id,
                        usage=usage,
                        provider_response_id=getattr(result, "request_id", None),
                        finish_reason="stop",
                    )

            # Synthesize text_completed with proper model info
            if hasattr(result, "response") and result.response:
                text_content = str(result.response)
                if text_content:
                    model_name, provider_name = self._resolve_model_provider(result)
                    event_id = self.event_tracker.start_text(agent)
                    self.event_tracker.add_text_delta(event_id, text_content)

                    # Extract model info from result or use defaults
                    provider_request_id = getattr(result, "request_id", None)
                    provider_response_id = getattr(result, "provider_response_id", None)
                    if provider_response_id is None:
                        provider_response_id = getattr(result, "response_id", None)

                    self.event_tracker.complete_text(
                        event_id=event_id,
                        agent=agent,
                        usage=usage,
                        provider_request_id=provider_request_id,
                        provider_response_id=provider_response_id,
                        model_name=model_name,
                        provider_name=provider_name,
                    )

            # Synthesize tool calls if any
            if hasattr(result, "tool_calls") and result.tool_calls:
                for tool_call in result.tool_calls:
                    tool_name = getattr(tool_call, "name", "unknown")
                    args = getattr(tool_call, "args", {})
                    response = getattr(tool_call, "response", {})

                    event_id, _ = self.event_tracker.start_tool_call(
                        agent, tool_name, args
                    )
                    self.event_tracker.complete_tool_call(
                        event_id=event_id,
                        agent=agent,
                        tool_name=tool_name,
                        duration_ms=0,  # Non-streaming, no duration
                        usage=usage,
                        response=response,
                    )

            self.event_tracker.add_agent_run_completed(agent)

        except Exception as e:
            logger.error(f"Error synthesizing non-streaming events: {e}", exc_info=True)

    async def synthesize_for_agent(self, agent: str, result: Any) -> None:
        """Synthesize events for a delegated agent without streaming."""
        previous_context = self.current_context
        self.current_context = agent
        try:
            await self.synthesize_non_streaming(result)
        finally:
            self.current_context = previous_context

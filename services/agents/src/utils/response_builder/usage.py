"""Usage calculation and extraction utilities"""

from datetime import UTC, datetime
from typing import Any

from ...models.response_schema import (
    EventRecord,
    EventType,
    LastModelResponse,
    McpRequestCompletedData,
    RunUsage,
    TextCompletedData,
    ThinkingCompletedData,
    UsageDetails,
)


def extract_usage_from_result(result: Any) -> RunUsage:
    """Extract usage information from PydanticAI result"""
    try:
        if not result or not hasattr(result, "usage"):
            return RunUsage()

        usage_attr = result.usage
        usage = usage_attr() if callable(usage_attr) else usage_attr

        # Extract token counts with proper separation
        input_tokens = getattr(usage, "input_tokens", 0)
        output_tokens = getattr(usage, "output_tokens", 0)
        reasoning_tokens = getattr(usage, "reasoning_tokens", 0)
        cache_write_tokens = getattr(usage, "cache_write_tokens", 0)
        cache_read_tokens = getattr(usage, "cache_read_tokens", 0)
        input_audio_tokens = getattr(usage, "input_audio_tokens", 0)
        cache_audio_read_tokens = getattr(usage, "cache_audio_read_tokens", 0)

        # Extract request counts
        requests = getattr(usage, "request_count", 1)
        tool_calls = getattr(usage, "tool_call_count", 0)

        # Extract details
        details = getattr(usage, "details", {})
        if not isinstance(details, dict):
            details = {}

        return RunUsage(
            requests=requests,
            tool_calls=tool_calls,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            reasoning_tokens=reasoning_tokens,
            cache_write_tokens=cache_write_tokens,
            cache_read_tokens=cache_read_tokens,
            input_audio_tokens=input_audio_tokens,
            cache_audio_read_tokens=cache_audio_read_tokens,
            details=details,
        )

    except Exception as e:
        print(f"Error extracting usage from result: {e}")
        return RunUsage()


def compute_run_usage(events: list[EventRecord]) -> RunUsage:
    """Compute run-level usage as sum of per-event usage"""
    total_input = 0
    total_output = 0
    total_reasoning = 0
    total_cache_write = 0
    total_cache_read = 0
    total_input_audio = 0
    total_cache_audio_read = 0
    details: dict[str, Any] = {}

    model_response_count = 0
    tool_call_count = 0

    for event in events:
        # Check if this event type has usage data
        if (
            isinstance(
                event.data,
                TextCompletedData | ThinkingCompletedData | McpRequestCompletedData,
            )
            and event.data.usage
        ):
            u = event.data.usage
            total_input += u.input_tokens
            total_output += u.output_tokens
            total_reasoning += u.reasoning_tokens
            total_cache_write += u.cache_write_tokens
            total_cache_read += u.cache_read_tokens
            total_input_audio += u.input_audio_tokens
            total_cache_audio_read += u.cache_audio_read_tokens

            # Merge details
            if u.details:
                details.update(u.details)

        # Count events
        if event.type in [EventType.TEXT_COMPLETED, EventType.THINKING_COMPLETED]:
            model_response_count += 1
        elif event.type == EventType.TOOL_CALL_COMPLETED:
            tool_call_count += 1

    return RunUsage(
        requests=model_response_count,
        tool_calls=tool_call_count,
        input_tokens=total_input,
        output_tokens=total_output,
        reasoning_tokens=total_reasoning,
        cache_write_tokens=total_cache_write,
        cache_read_tokens=total_cache_read,
        input_audio_tokens=total_input_audio,
        cache_audio_read_tokens=total_cache_audio_read,
        details=details,
    )


def extract_last_model_response(
    result: Any, events: list[EventRecord] | None = None
) -> LastModelResponse:
    """Extract last model response metadata from final text_completed event"""
    try:
        model_response: Any = getattr(result, "response", None)
        if callable(model_response):  # AgentRunResult exposes property; safeguard
            model_response = model_response()

        # First try to extract from final text_completed event
        if events:
            text_events = [e for e in events if e.type == EventType.TEXT_COMPLETED]
            if text_events:
                last_event = text_events[-1]
                event_data = last_event.data

                # Type guard: TextCompletedData from TEXT_COMPLETED events
                if isinstance(event_data, TextCompletedData):
                    return LastModelResponse(
                        timestamp=last_event.ts,
                        model_name=event_data.model_name,
                        provider_name=event_data.provider_name,
                        finish_reason=event_data.finish_reason,
                        provider_response_id=event_data.provider_response_id or "",
                        usage=event_data.usage or UsageDetails(),
                    )

        # Fallback: extract from result
        if not result:
            return LastModelResponse(
                timestamp=datetime.now(UTC),
                model_name="unknown",
                provider_name="unknown",
                finish_reason="no_result",
                provider_response_id="",
                usage=UsageDetails(),
            )

        if model_response is not None and hasattr(model_response, "usage"):
            usage_source = model_response.usage
            if callable(usage_source):
                usage_source = usage_source()
            usage_details = UsageDetails(
                input_tokens=getattr(usage_source, "input_tokens", 0),
                output_tokens=getattr(usage_source, "output_tokens", 0),
                reasoning_tokens=getattr(usage_source, "reasoning_tokens", 0),
                cache_write_tokens=getattr(usage_source, "cache_write_tokens", 0),
                cache_read_tokens=getattr(usage_source, "cache_read_tokens", 0),
                input_audio_tokens=getattr(usage_source, "input_audio_tokens", 0),
                cache_audio_read_tokens=getattr(
                    usage_source, "cache_audio_read_tokens", 0
                ),
                details=getattr(usage_source, "details", {}) or {},
            )
        else:
            run_usage = extract_usage_from_result(result)
            usage_details = UsageDetails(
                input_tokens=run_usage.input_tokens,
                output_tokens=run_usage.output_tokens,
                reasoning_tokens=run_usage.reasoning_tokens,
                cache_write_tokens=run_usage.cache_write_tokens,
                cache_read_tokens=run_usage.cache_read_tokens,
                input_audio_tokens=run_usage.input_audio_tokens,
                cache_audio_read_tokens=run_usage.cache_audio_read_tokens,
                details=run_usage.details,
            )

        # Extract provider information from result attributes
        provider_name = "unknown"
        model_name = "unknown"
        finish_reason = "stop"
        provider_response_id = ""

        source = model_response or result

        if hasattr(source, "provider"):
            provider_name = str(source.provider)
        if hasattr(source, "provider_name"):
            provider_name = str(source.provider_name)

        if hasattr(source, "model"):
            model_name = str(source.model)
        if hasattr(source, "model_name"):
            model_name = str(source.model_name)

        if hasattr(source, "finish_reason"):
            finish_reason = str(source.finish_reason)
        elif hasattr(source, "stop_reason"):
            finish_reason = str(source.stop_reason)

        if hasattr(source, "provider_response_id"):
            provider_response_id = str(source.provider_response_id)
        elif hasattr(source, "response_id"):
            provider_response_id = str(source.response_id)
        elif hasattr(source, "id"):
            provider_response_id = str(source.id)

        # Create UsageDetails with proper token separation
        last_usage = usage_details

        timestamp = getattr(source, "timestamp", datetime.now(UTC))
        if isinstance(timestamp, str):
            try:
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except ValueError:
                timestamp = datetime.now(UTC)

        return LastModelResponse(
            timestamp=timestamp,
            model_name=model_name,
            provider_name=provider_name,
            finish_reason=finish_reason,
            provider_response_id=provider_response_id,
            usage=last_usage,
        )
    except Exception as e:
        print(f"Error extracting last model response: {e}")
        return LastModelResponse(
            timestamp=datetime.now(UTC),
            model_name="unknown",
            provider_name="unknown",
            finish_reason="error",
            provider_response_id="",
            usage=UsageDetails(),
        )

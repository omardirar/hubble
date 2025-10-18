from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from pydantic_ai.messages import PartDeltaEvent, PartStartEvent, TextPart, TextPartDelta
from pydantic_ai.run import AgentRunResult, AgentRunResultEvent

from hubble_agents.utils.streaming import (
    AgentEvent,
    EventEncoder,
    EventHub,
    EventSource,
    RunRecorder,
    StreamingRuntime,
)


def test_run_recorder_accumulates_text_and_output() -> None:
    recorder = RunRecorder()
    source = EventSource(agent="supervisor", run_id="run_sup")

    recorder.observe(source, PartStartEvent(index=0, part=TextPart(content="Hello")))
    recorder.observe(
        source,
        PartDeltaEvent(index=0, delta=TextPartDelta(content_delta=" world")),
    )
    recorder.observe(
        source,
        AgentRunResultEvent(result=AgentRunResult(output="Hello world")),
    )

    summary = recorder.summary("run_sup")
    assert summary["output"] == "Hello world"
    assert summary["text_parts"] == [{"index": 0, "text": "Hello world"}]


def test_event_encoder_formats_text_delta() -> None:
    encoder = EventEncoder()
    source = EventSource(agent="supervisor", run_id="run_sup")
    event = PartDeltaEvent(index=1, delta=TextPartDelta(content_delta="chunk"))

    encoded = encoder.encode(source=source, event=event)
    assert encoded is not None
    event_type, data = encoded
    assert event_type == "text.delta"
    assert data == {"delta": "chunk"}


@pytest.mark.asyncio
async def test_streaming_runtime_stream_agent_forwards_events() -> None:
    hub = EventHub()
    runtime = StreamingRuntime(hub=hub)
    source = runtime.new_source(agent="demo")

    async def fake_events() -> AsyncIterator[AgentEvent]:
        yield PartStartEvent(index=0, part=TextPart(content="Hi"))
        yield AgentRunResultEvent(result=AgentRunResult(output="Hi"))

    result_event = await runtime.stream_agent(source, fake_events())
    assert result_event.result.output == "Hi"

    frame_one = await hub.next_frame()
    frame_two = await hub.next_frame()

    assert frame_one is not None and '"text.delta"' in frame_one
    assert frame_two is not None and '"run.result"' in frame_two

    assert hub.empty()

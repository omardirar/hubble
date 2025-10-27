"""Runs router with LangGraph integration and SSE streaming."""

import json
import logging
from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage

from h10s.api.deps import get_interactions_repo, get_motherduck_repo, require_auth
from h10s.config import AppSettings, get_settings
from h10s.db.repositories import InteractionsRepository, MotherDuckRepository
from h10s.graphs.copilot import agent
from h10s.schema import CreateRunRequest, RunResponse
from h10s.schema.domain import AuthContext

router = APIRouter(prefix="/api/v1", tags=["runs"])

logger = logging.getLogger(__name__)


@router.post("/runs", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def create_run(
    request: CreateRunRequest,
    auth: AuthContext = Depends(require_auth),
    repo: InteractionsRepository = Depends(get_interactions_repo),
) -> RunResponse:
    """Create a new run (without executing it yet).

    Use GET /runs/{id}/events to start streaming execution.
    """
    # Verify thread exists
    thread = await repo.get_thread(request.thread_id, auth.org_id)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # Create run record
    run = await repo.create_run(
        thread_id=request.thread_id, org_id=auth.org_id, metadata=request.metadata
    )

    return RunResponse(**run)


@router.get("/runs/{run_id}/events")
async def stream_run_events(
    run_id: UUID,
    auth: AuthContext = Depends(require_auth),
    repo: InteractionsRepository = Depends(get_interactions_repo),
    motherduck_repo: MotherDuckRepository = Depends(get_motherduck_repo),
    settings: AppSettings = Depends(get_settings),
) -> StreamingResponse:
    """Stream run execution events via SSE."""
    # Get run
    run = await repo.get_run(run_id, auth.org_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    thread_id = run["thread_id"]

    # Get thread messages to build input
    messages = await repo.get_messages(thread_id, auth.org_id, limit=10)
    if not messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Thread has no messages"
        )

    # Get last user message as input
    user_messages = [m for m in messages if m["role"] == "user"]
    if not user_messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No user messages in thread"
        )

    input_text = user_messages[0].get("text_content") or json.dumps(user_messages[0]["content"])

    # Resolve MotherDuck headers for this org
    mcp_headers = await motherduck_repo.build_mcp_headers(auth.org_id)

    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE events from LangGraph execution."""
        try:
            # Update run status
            await repo.update_run_status(run_id, "running")

            # Emit start event
            start_data = {"run_id": str(run_id), "status": "running"}
            yield f"event: run.started\ndata: {json.dumps(start_data)}\n\n"

            # Load graph with MCP headers
            graph = agent({"configurable": {"motherduck_headers": mcp_headers}})

            # Prepare input
            input_state = {"messages": [HumanMessage(content=input_text)]}

            # Stream events
            async for event in graph.astream_events(input_state, version="v2"):
                event_type = event.get("event")
                event_data = event.get("data", {})

                # Map LangGraph events to our SSE format
                if event_type == "on_chat_model_stream":
                    # Token streaming
                    chunk = event_data.get("chunk", {})
                    if hasattr(chunk, "content") and chunk.content:
                        delta_data = {"delta": chunk.content}
                        yield f"event: block.delta\ndata: {json.dumps(delta_data)}\n\n"

                elif event_type == "on_tool_start":
                    tool_name = event_data.get("name")
                    yield f"event: tool.started\ndata: {json.dumps({'tool': tool_name})}\n\n"

                elif event_type == "on_tool_end":
                    yield f"event: tool.finished\ndata: {json.dumps({})}\n\n"

                elif event_type == "on_chain_end":
                    # Check if this is the final output
                    output = event_data.get("output")
                    if output and "messages" in output:
                        # Save assistant messages to thread
                        for msg in output["messages"]:
                            if hasattr(msg, "type") and msg.type == "ai":
                                await repo.create_message(
                                    thread_id=thread_id,
                                    org_id=auth.org_id,
                                    role="assistant",
                                    content={"text": msg.content},
                                    author_user_id=None,
                                )

            # Update run status to completed
            await repo.update_run_status(run_id, "completed")
            completed_data = {"run_id": str(run_id), "status": "completed"}
            yield f"event: run.completed\ndata: {json.dumps(completed_data)}\n\n"

        except Exception as e:
            logger.error("Run execution failed run_id=%s error=%s", run_id, e, exc_info=True)
            await repo.update_run_status(run_id, "failed", error=str(e))
            failed_data = {"run_id": str(run_id), "error": str(e)}
            yield f"event: run.failed\ndata: {json.dumps(failed_data)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

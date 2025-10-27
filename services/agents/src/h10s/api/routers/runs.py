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


@router.post("/runs", response_model=None)
async def create_run(
    request: CreateRunRequest,
    auth: AuthContext = Depends(require_auth),
    repo: InteractionsRepository = Depends(get_interactions_repo),
    motherduck_repo: MotherDuckRepository = Depends(get_motherduck_repo),
    settings: AppSettings = Depends(get_settings),
) -> RunResponse | StreamingResponse:
    """Create and optionally stream a run.

    If stream=true: Immediately executes and streams via SSE
    If stream=false: Returns run details without executing
    """
    logger.info(
        "Creating run thread_id=%s org_id=%s user_id=%s stream=%s",
        request.thread_id,
        auth.org_id,
        auth.user_id,
        request.stream,
    )

    # Verify thread exists
    thread = await repo.get_thread(request.thread_id, auth.org_id)
    if not thread:
        logger.warning("Thread not found thread_id=%s org_id=%s", request.thread_id, auth.org_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # Add message to thread if provided
    if request.message:
        logger.debug(
            "Adding user message to thread thread_id=%s message_length=%d",
            request.thread_id,
            len(request.message),
        )
        await repo.create_message(
            thread_id=request.thread_id,
            org_id=auth.org_id,
            role="user",
            content={"text": request.message},
            author_user_id=auth.user_id,
        )

    # Create run record
    run = await repo.create_run(
        thread_id=request.thread_id, org_id=auth.org_id, metadata=request.metadata
    )
    logger.info(
        "Run created run_id=%s thread_id=%s org_id=%s", run["id"], request.thread_id, auth.org_id
    )

    # If streaming, start execution immediately
    if request.stream:
        logger.info("Starting streaming execution run_id=%s", run["id"])
        return await _stream_run_execution(
            run_id=run["id"],
            thread_id=request.thread_id,
            auth=auth,
            repo=repo,
            motherduck_repo=motherduck_repo,
        )

    # Otherwise return run details
    logger.info("Returning run details without execution run_id=%s", run["id"])
    return RunResponse(**run)


async def _stream_run_execution(
    run_id: UUID,
    thread_id: UUID,
    auth: AuthContext,
    repo: InteractionsRepository,
    motherduck_repo: MotherDuckRepository,
) -> StreamingResponse:
    """Internal helper to stream run execution via SSE."""
    logger.debug(
        "Preparing run execution run_id=%s thread_id=%s org_id=%s", run_id, thread_id, auth.org_id
    )

    # Get thread messages to build input
    messages = await repo.get_messages(thread_id, auth.org_id, limit=10)
    if not messages:
        logger.warning("No messages in thread thread_id=%s org_id=%s", thread_id, auth.org_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Thread has no messages"
        )

    # Get last user message as input
    user_messages = [m for m in messages if m["role"] == "user"]
    if not user_messages:
        logger.warning("No user messages found in thread thread_id=%s", thread_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No user messages in thread"
        )

    input_text = user_messages[0].get("text_content") or json.dumps(user_messages[0]["content"])
    logger.debug("Using user message as input length=%d thread_id=%s", len(input_text), thread_id)

    # Resolve MotherDuck headers for this org
    logger.debug("Building MCP headers for org_id=%s", auth.org_id)
    mcp_headers = await motherduck_repo.build_mcp_headers(auth.org_id)
    logger.debug("MCP headers built header_count=%d", len(mcp_headers))

    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE events from LangGraph execution."""
        logger.info("Starting SSE event generator run_id=%s", run_id)
        try:
            # Update run status
            await repo.update_run_status(run_id, "running")
            logger.debug("Updated run status to 'running' run_id=%s", run_id)

            # Emit start event
            start_data = {"run_id": str(run_id), "status": "running"}
            yield f"event: run.started\ndata: {json.dumps(start_data)}\n\n"

            # Load graph with MCP headers
            logger.debug("Loading agent graph run_id=%s", run_id)
            graph = agent({"configurable": {"motherduck_headers": mcp_headers}})
            logger.debug("Agent graph loaded successfully run_id=%s", run_id)

            # Prepare input
            input_state = {"messages": [HumanMessage(content=input_text)]}
            logger.info("Starting graph execution run_id=%s", run_id)

            # Stream events
            event_count = 0
            async for event in graph.astream_events(input_state, version="v2"):
                event_type = event.get("event")
                event_data = event.get("data", {})
                event_count += 1

                if event_count % 10 == 0:
                    logger.debug("Processed %d events run_id=%s", event_count, run_id)

                # Map LangGraph events to our SSE format
                if event_type == "on_chat_model_stream":
                    # Token streaming
                    chunk = event_data.get("chunk", {})
                    if hasattr(chunk, "content") and chunk.content:
                        delta_data = {"delta": chunk.content}
                        yield f"event: block.delta\ndata: {json.dumps(delta_data)}\n\n"

                elif event_type == "on_tool_start":
                    tool_name = event_data.get("name")
                    logger.debug("Tool started tool=%s run_id=%s", tool_name, run_id)
                    yield f"event: tool.started\ndata: {json.dumps({'tool': tool_name})}\n\n"

                elif event_type == "on_tool_end":
                    logger.debug("Tool finished run_id=%s", run_id)
                    yield f"event: tool.finished\ndata: {json.dumps({})}\n\n"

                elif event_type == "on_chain_end":
                    # Check if this is the final output
                    output = event_data.get("output")
                    if output and "messages" in output:
                        logger.debug("Processing chain output messages run_id=%s", run_id)
                        # Save assistant messages to thread
                        message_count = 0
                        for msg in output["messages"]:
                            if hasattr(msg, "type") and msg.type == "ai":
                                await repo.create_message(
                                    thread_id=thread_id,
                                    org_id=auth.org_id,
                                    role="assistant",
                                    content={"text": msg.content},
                                    author_user_id=None,
                                )
                                message_count += 1
                        logger.debug("Saved %d assistant messages run_id=%s", message_count, run_id)

            # Update run status to completed
            logger.info("Run completed successfully run_id=%s event_count=%d", run_id, event_count)
            await repo.update_run_status(run_id, "completed")
            completed_data = {"run_id": str(run_id), "status": "completed"}
            yield f"event: run.completed\ndata: {json.dumps(completed_data)}\n\n"

        except Exception as e:
            logger.error(
                "Run execution failed run_id=%s org_id=%s error=%s",
                run_id,
                auth.org_id,
                e,
                exc_info=True,
            )
            await repo.update_run_status(run_id, "failed", error=str(e))
            failed_data = {"run_id": str(run_id), "error": str(e)}
            yield f"event: run.failed\ndata: {json.dumps(failed_data)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

"""FastAPI application exposing the supervisor agent as an SSE endpoint."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic_ai.run import AgentRunResultEvent
from starlette.responses import StreamingResponse

from .agents import SupervisorDeps, create_supervisor_agent
from .config.settings import validate_environment
from .db import record_agent_run
from .middleware.auth import ServiceTokenPayload, get_current_user
from .middleware.rate_limit import check_rate_limit
from .middleware.security import SecurityHeadersMiddleware
from .models.requests import ChatRequest
from .utils.logging import get_logger
from .utils.streaming import EventHub, StreamingRuntime, build_child_summaries

logger = get_logger(__name__)
settings = validate_environment()
supervisor_agent = create_supervisor_agent(settings)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Verify minimal configuration on startup."""

    logger.info("Application startup complete")
    yield
    logger.info("Application shutdown complete")


app = FastAPI(
    title="Hubble Agents API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.environment == "production" else "/docs",
    redoc_url=None,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*.fly.dev", "localhost", "127.0.0.1"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.dashboard_url],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "X-User-Id", "X-Org-Id", "X-Conversation-Id"],
    max_age=600,
)


@app.get("/health")
async def health() -> dict[str, Any]:
    """Return a basic health payload."""

    return {
        "status": "healthy",
        "service": "agent-backend",
        "environment": settings.environment,
    }


@app.post("/api/chat/stream")
async def stream_chat(
    request: ChatRequest,
    http_request: Request,
    current_user: ServiceTokenPayload = Depends(get_current_user),  # noqa: B008
    _rate_limit: None = Depends(check_rate_limit),
) -> StreamingResponse:
    """Stream an SSE response from the supervisor agent."""

    _validate_user(request, current_user)

    if not request.messages:
        raise HTTPException(status_code=400, detail="At least one message is required")

    user_prompt = request.messages[-1].content
    metadata = {
        "conversation_id": request.conversation_id,
        "org_id": request.org_id,
        "user_id": request.user_id,
    }

    event_hub = EventHub()
    runtime = StreamingRuntime(hub=event_hub)

    supervisor_source = runtime.new_source(
        agent=supervisor_agent.name or "supervisor",
    )

    deps = SupervisorDeps(
        settings=settings,
        org_id=request.org_id,
        user_id=request.user_id,
        conversation_id=request.conversation_id,
        run_id=supervisor_source.run_id,
        streaming=runtime,
        motherduck_url=settings.mcp.motherduck_url,
        motherduck_token=request.motherduck_token,
        database_name=request.database_name,
        metadata=metadata,
    )

    await event_hub.emit_manual(
        source=supervisor_source,
        event_type="run.start",
        data=dict(metadata),
    )

    async def drive_supervisor() -> AgentRunResultEvent[str]:
        try:
            return await runtime.stream_agent(
                supervisor_source,
                supervisor_agent.run_stream_events(
                    user_prompt,
                    deps=deps,
                ),
            )
        except TimeoutError as exc:
            logger.exception(
                "Supervisor run timed out",
                extra={"conversation_id": request.conversation_id},
            )
            await event_hub.emit_manual(
                source=supervisor_source,
                event_type="run.result",
                data={
                    "output": f"Agent execution timed out: {exc}",
                    "usage": None,
                },
            )
            raise HTTPException(status_code=504, detail="Agent execution timed out") from exc
        except Exception as exc:
            logger.exception(
                "Supervisor run failed",
                extra={"conversation_id": request.conversation_id},
            )
            await event_hub.emit_manual(
                source=supervisor_source,
                event_type="run.result",
                data={
                    "output": f"Agent execution failed: {exc}",
                    "usage": None,
                },
            )
            raise HTTPException(status_code=500, detail=f"Agent execution failed: {exc}") from exc

    supervisor_task = asyncio.create_task(drive_supervisor())
    supervisor_result: AgentRunResultEvent[str] | None = None

    async def event_stream() -> AsyncIterator[str]:
        nonlocal supervisor_result
        flushed_terminus = False

        try:
            while True:
                frame = await event_hub.next_frame(timeout=0.1)
                if frame is not None:
                    yield frame
                    continue

                if await http_request.is_disconnected():
                    raise asyncio.CancelledError

                if supervisor_task.done():
                    if not flushed_terminus:
                        await event_hub.flush_all()
                        flushed_terminus = True
                        continue
                    if event_hub.empty():
                        break
                    continue

        except asyncio.CancelledError:
            supervisor_task.cancel()
            raise
        finally:
            try:
                supervisor_result = await supervisor_task
            except asyncio.CancelledError:
                raise
            except Exception:
                supervisor_result = None
            await event_hub.flush_all()
            while not event_hub.empty():
                remaining = await event_hub.next_frame()
                if remaining is not None:
                    yield remaining

            if supervisor_result is not None:
                summary = event_hub.recorder.summary(supervisor_source.run_id)
                child_runs = build_child_summaries(event_hub.recorder, supervisor_source.run_id)
                try:
                    await record_agent_run(
                        org_id=request.org_id,
                        user_id=request.user_id,
                        conversation_id=request.conversation_id,
                        prompt=user_prompt,
                        response=str(summary.get("output") or ""),
                        usage=summary.get("usage"),
                        text_parts=summary.get("text_parts"),
                        thinking_parts=summary.get("thinking_parts"),
                        tool_results=summary.get("tool_results"),
                        child_runs=child_runs,
                    )
                except Exception:  # pragma: no cover - persistence best effort
                    logger.exception(
                        "Failed to persist agent run",
                        extra={"conversation_id": request.conversation_id},
                    )

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _validate_user(request: ChatRequest, current_user: ServiceTokenPayload) -> None:
    if (
        request.org_id != current_user.org_id
        or request.user_id != current_user.user_id
        or request.conversation_id != current_user.conversation_id
    ):
        raise HTTPException(status_code=403, detail="Request does not match authenticated user")

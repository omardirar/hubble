"""Copilot streaming endpoint leveraging the service layer."""

import asyncio
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from slowapi import Limiter  # type: ignore[import]
from slowapi.util import get_remote_address  # type: ignore[import]
from sse_starlette.sse import EventSourceResponse

from h10s.api.deps import get_app_context, require_authenticated_user
from h10s.crews.registry import get_crew_class
from h10s.db import DatabaseUnavailableError
from h10s.middleware import JWTClaims
from h10s.models import AppContext, CopilotStreamRequest, MessageStatus
from h10s.services import AgentExecutionService, ConversationService
from h10s.validation import validate_claims_match_request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/stream", response_class=EventSourceResponse)
@limiter.limit("10/minute")
async def stream_copilot(
    request: Request,
    payload: CopilotStreamRequest = Body(...),  # noqa: B008
    claims: JWTClaims = Depends(require_authenticated_user),  # noqa: B008
    context: AppContext = Depends(get_app_context),  # noqa: B008
) -> EventSourceResponse:
    """Stream Copilot responses via Server-Sent Events.

    Returns:
        Server-Sent Events stream with crew execution updates and results.
    """

    logger.info(
        "Received copilot stream request conversation_id=%s org_id=%s user_id=%s",
        payload.conversation_id,
        payload.org_id,
        payload.user_id,
    )
    validate_claims_match_request(payload, claims)

    conversation_service = ConversationService(context.conversations, context.messages)
    execution_service = AgentExecutionService(context.messages, context.runs)

    try:
        # Extract title safely with type checking
        title = None
        if payload.metadata and isinstance(payload.metadata, dict):
            title = payload.metadata.get("title")

        await conversation_service.ensure_conversation_with_access(
            conversation_id=payload.conversation_id,
            org_id=payload.org_id,
            user_id=payload.user_id,
            title=title,
            metadata=payload.metadata if isinstance(payload.metadata, dict) else {},
        )

        user_message_content = {
            "schema_version": 1,
            "blocks": [
                {
                    "type": "user_prompt",
                    "text": payload.prompt,
                }
            ],
            "metadata": payload.metadata or {},
        }
        _, user_seq = await conversation_service.create_user_message(
            conversation_id=payload.conversation_id,
            content=user_message_content,
        )
        logger.info(
            "User message captured conversation_id=%s seq=%s",
            payload.conversation_id,
            user_seq,
        )
    except PermissionError as exc:
        logger.warning(
            "Permission denied for conversation_id=%s org_id=%s user_id=%s",
            payload.conversation_id,
            payload.org_id,
            payload.user_id,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DatabaseUnavailableError as exc:
        logger.error("Supabase persistence unavailable", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Persistence backend is unavailable. Please try again later.",
        ) from exc

    run_id = uuid.uuid4()

    crew_cls = get_crew_class("copilot")
    crew = crew_cls(context.settings, context.tools)  # type: ignore[call-arg]
    logger.debug("Crew instantiated name=%s version=%s", crew.name, crew.version)

    await context.run_listener.record_run_start(
        run_id=run_id,
        conversation_id=payload.conversation_id,
        crew_name=crew.name,
        crew_version=crew.version,
    )

    try:
        await context.message_listener.update_assistant_message(
            conversation_id=payload.conversation_id,
            run_id=run_id,
            seq=user_seq + 1,
            status=MessageStatus.STREAMING.value,
            content={"schema_version": 1, "blocks": []},
        )
    except DatabaseUnavailableError as exc:
        logger.error("Supabase persistence unavailable during stream initialisation", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Persistence backend is unavailable. Please try again later.",
        ) from exc

    # Create pending SSE stream (SSE uses string keys for run_id)
    queue = await context.sse_listener.create_pending_stream(str(run_id))
    logger.debug("Pending SSE stream established run_id=%s", run_id)

    async def execute() -> None:
        try:
            await execution_service.execute_crew(
                crew=crew,
                conversation_id=payload.conversation_id,
                prompt=payload.prompt,
                user_message_seq=user_seq,
                run_id=run_id,
            )
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.exception(
                "Crew execution failed", extra={"run_id": str(run_id), "error": str(exc)}
            )
        else:
            logger.info("Crew execution complete run_id=%s", run_id)

    task = asyncio.create_task(execute())
    context.background_tasks.add(task)
    task.add_done_callback(context.background_tasks.discard)

    async def event_generator() -> AsyncIterator[str]:  # pragma: no cover - networking helper
        while True:
            # No timeout to avoid premature stream closure for long-running crews
            # Client-side timeout or ping interval will handle connection issues
            item = await queue.get()
            if item is None:
                logger.debug("SSE stream completed run_id=%s", run_id)
                break
            logger.debug(
                "Dispatching SSE event run_id=%s event=%s",
                run_id,
                item.event,
            )
            yield item.render()

    return EventSourceResponse(
        event_generator(),
        ping=context.settings.sse_ping_interval_seconds,
        status_code=status.HTTP_202_ACCEPTED,
    )


__all__ = ["router"]

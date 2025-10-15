"""FastAPI application for Pydantic AI agents"""

import asyncio
import json
import os
import time
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sse_starlette import EventSourceResponse

from .graph.workflow import IterativeAgentWorkflow
from .middleware.auth import ServiceTokenPayload, get_current_user
from .middleware.rate_limit import check_rate_limit
from .middleware.security import SecurityHeadersMiddleware
from .tools.registry import get_registry
from .utils.audit import log_agent_decision, log_security_event
from .utils.logging import get_logger
from .utils.validation import ChatRequest

logger = get_logger(__name__)


app = FastAPI(
    title="Hubble Agent Backend",
    version="1.0.0",
    docs_url=None if os.getenv("ENVIRONMENT") == "production" else "/docs",
    redoc_url=None,
)

# Security middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*.fly.dev", "localhost", "127.0.0.1"])

# CORS
allowed_origins = [os.getenv("DASHBOARD_URL", "http://localhost:3000")]
if os.getenv("ENVIRONMENT") != "production":
    allowed_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "X-User-Id", "X-Org-Id", "X-Conversation-Id"],
    max_age=600,
)


@app.on_event("startup")
async def validate_environment() -> None:
    """Validate required environment variables on startup"""
    required_vars = ["ANTHROPIC_API_KEY", "SERVICE_AUTH_SECRET"]
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        logger.error(f"Missing required environment variables: {missing}")
        raise RuntimeError(f"Missing environment variables: {missing}")

    logger.info("Environment validation passed")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Handle application shutdown"""
    logger.info("Application shutting down...")

    # Shutdown tool registry
    try:
        registry = get_registry()
        await registry.shutdown()
        logger.info("Tool registry shutdown complete")
    except Exception as e:
        logger.error(f"Error during tool registry shutdown: {e}")

    logger.info("Application shutdown complete")


@app.get("/health")
async def health_check() -> dict[str, Any]:
    """Public health check endpoint"""
    return {
        "status": "healthy",
        "service": "agent-backend",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
    }


@app.post("/api/chat/stream")
async def stream_chat(
    request: ChatRequest,
    current_user: ServiceTokenPayload = Depends(get_current_user),  # noqa: B008
    _rate_limit: None = Depends(check_rate_limit),
) -> EventSourceResponse:
    """Stream chat response with iterative Pydantic AI agents"""

    # Validate request matches authenticated user
    if (
        request.org_id != current_user.org_id
        or request.user_id != current_user.user_id
        or request.conversation_id != current_user.conversation_id
    ):
        log_security_event(
            "unauthorized_access_attempt",
            current_user.user_id,
            current_user.org_id,
            {"request_org": request.org_id},
        )
        raise HTTPException(403, "Request does not match authenticated user")

    # Log request
    logger.info(
        "chat_request_received",
        extra={
            "org_id": current_user.org_id,
            "user_id": current_user.user_id,
            "conversation_id": current_user.conversation_id,
            "message_count": len(request.messages),
        },
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            user_message = request.messages[-1].content

            # Initialize iterative workflow
            workflow = IterativeAgentWorkflow()

            # Execute workflow and stream events
            async for event in workflow.execute(
                user_message=user_message,
                conversation_id=request.conversation_id,
                org_id=current_user.org_id,
                user_id=current_user.user_id,
                motherduck_token=request.motherduck_token,
                database_name=request.database_name,
                mcp_server_url=os.getenv("MCP_SERVER_URL"),
            ):
                # Log agent decisions for audit
                if event.get("event") == "step":
                    agent = event["data"].get("agent")
                    action = event["data"].get("action")
                    if agent and action:
                        log_agent_decision(agent, action, current_user.user_id, current_user.org_id)

                # Format as proper SSE with event type and JSON data
                event_type = event.get("event", "message").upper()
                event_data = json.dumps(event.get("data", {}), default=str)

                yield f"event: {event_type}\n"
                yield f"data: {event_data}\n\n"

                # Add small delay for streaming effect
                await asyncio.sleep(0.01)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                "chat_error",
                extra={
                    "org_id": current_user.org_id,
                    "user_id": current_user.user_id,
                    "conversation_id": current_user.conversation_id,
                    "error": str(e),
                },
                exc_info=True,
            )

            error_data = json.dumps(
                {
                    "error": "An error occurred processing your request",
                    "error_type": type(e).__name__,
                    "timestamp": time.time(),
                }
            )
            yield "event: ERROR\n"
            yield f"data: {error_data}\n\n"

    return EventSourceResponse(event_generator())

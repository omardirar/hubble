"""FastAPI application factory for the H10S agents service."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter  # type: ignore[import]
from slowapi.util import get_remote_address  # type: ignore[import]

from h10s.api import copilot_router, health_router
from h10s.config import (
    configure_logging,
    get_settings,
    maybe_configure_tracing,
    validate_environment,
)
from h10s.db import SupabaseClient
from h10s.db.repositories import ConversationRepository, MessageRepository, RunRepository
from h10s.listeners import (
    FrontendSSEListener,
    ListenerRegistry,
    MessagePersistenceListener,
    RunLifecycleListener,
    TelemetryListener,
)
from h10s.middleware.request_validation import RequestSizeMiddleware
from h10s.middleware.security import SecurityHeadersMiddleware
from h10s.models import AppContext
from h10s.tools import ToolRegistry

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Configure and return the FastAPI application instance."""

    validate_environment()
    configure_logging()
    settings = get_settings()

    logger.info("Initialising FastAPI application environment=%s", settings.environment)

    # Initialise shared infrastructure components.
    supabase_client = SupabaseClient(settings)
    logger.debug("Supabase client initialised")
    conversations = ConversationRepository(supabase_client)
    messages = MessageRepository(supabase_client)
    runs = RunRepository(supabase_client)
    tools = ToolRegistry()
    logger.debug("Core repositories and tool registry initialised")

    sse_listener = FrontendSSEListener()
    message_listener = MessagePersistenceListener(messages, conversations)
    run_listener = RunLifecycleListener(runs, conversations)
    telemetry_listener = TelemetryListener()
    logger.debug("Listener instances created")

    listener_registry = ListenerRegistry()
    listener_registry.extend([sse_listener, message_listener, run_listener, telemetry_listener])
    logger.debug(
        "Listener registry populated with %s listeners",
        len(listener_registry.listeners),
    )

    # Create rate limiter
    limiter = Limiter(key_func=get_remote_address)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        """Handle application startup and shutdown lifecycle."""
        # Startup
        logger.info("Starting H10S Copilot API")
        await supabase_client.ensure_ready()  # Initialize client eagerly
        logger.debug("Supabase client ready")
        maybe_configure_tracing(app)
        yield
        # Shutdown
        logger.info("Shutting down H10S Copilot API")
        # Cancel and await all background tasks
        tasks = list(app.state.app_context.background_tasks)
        for task in tasks:
            task.cancel()
            logger.debug("Cancelled background task %s", task.get_name())
        # Wait for tasks to complete (with exception handling)
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in results:
            if isinstance(result, Exception):
                logger.warning("Background task ended with exception: %s", result)
        # Close database pool
        await supabase_client.close()
        logger.debug("Supabase client closed")

    app = FastAPI(
        title="H10S Copilot API",
        version="0.1.0",
        docs_url=None if settings.environment == "production" else "/docs",
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestSizeMiddleware, max_body_size=settings.max_request_body_size)
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.allowed_hosts,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )

    # Configure rate limiting
    app.state.limiter = limiter
    app.state.app_context = AppContext(
        settings=settings,
        db=supabase_client,
        conversations=conversations,
        messages=messages,
        runs=runs,
        tools=tools,
        sse_listener=sse_listener,
        run_listener=run_listener,
        message_listener=message_listener,
        listener_registry=listener_registry,
        background_tasks=set(),
    )

    app.include_router(health_router)
    app.include_router(copilot_router, prefix="/api")

    logger.info("FastAPI application initialised with prefix '/api'")

    return app


__all__ = ["create_app"]

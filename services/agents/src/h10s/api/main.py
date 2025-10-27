"""H10S Agents API - FastAPI application."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from h10s.api.routers import health, runs, threads
from h10s.config import get_settings, validate_environment
from h10s.db import close_pool, init_pool

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager - handles startup and shutdown."""
    # Startup
    logger.info("Starting H10S Agents API")

    try:
        settings = validate_environment()
        await init_pool(settings)
        logger.info("Database pool initialized")
    except Exception as e:
        logger.error("Failed to initialize application: %s", e)
        raise

    yield

    # Shutdown
    logger.info("Shutting down H10S Agents API")
    try:
        await close_pool()
        logger.info("Database pool closed")
    except Exception as e:
        logger.error("Error during shutdown: %s", e)


def create_app() -> FastAPI:
    """Create and configure FastAPI application.

    Returns:
        Configured FastAPI app instance
    """
    settings = get_settings()

    app = FastAPI(
        title="H10S Agents API",
        description="AI-powered marketing copilot with multi-specialist agent system",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment == "development" else None,
        redoc_url="/redoc" if settings.environment == "development" else None,
    )

    # Add security scheme for Swagger UI
    if settings.environment == "development":
        # This adds the "Authorize" button in /docs
        from typing import Any

        def custom_openapi() -> dict[str, Any]:
            if app.openapi_schema:
                return app.openapi_schema

            from fastapi.openapi.utils import get_openapi

            openapi_schema = get_openapi(
                title=app.title,
                version=app.version,
                description=app.description,
                routes=app.routes,
            )

            # Add security scheme
            openapi_schema["components"]["securitySchemes"] = {
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "Enter your Clerk JWT token",
                }
            }

            # Apply security to all paths except health check
            for path, path_item in openapi_schema.get("paths", {}).items():
                if "/health" not in path:
                    for method, operation in path_item.items():
                        # Skip non-operation keys like 'parameters', 'summary', etc.
                        if method in ["get", "post", "put", "patch", "delete", "options", "head"]:
                            if isinstance(operation, dict):
                                operation["security"] = [{"BearerAuth": []}]

            app.openapi_schema = openapi_schema
            return app.openapi_schema

        app.openapi = custom_openapi  # type: ignore[method-assign]

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(health.router)
    app.include_router(threads.router)
    app.include_router(runs.router)

    logger.info("FastAPI application created environment=%s", settings.environment)

    return app


# Create app instance
app = create_app()

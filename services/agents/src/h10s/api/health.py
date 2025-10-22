"""Simple health endpoint for uptime checks."""

from __future__ import annotations

import logging

from fastapi import APIRouter

from h10s.config.settings import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health() -> dict[str, str]:
    """Return service health metadata."""

    settings = get_settings()
    logger.debug("Health check requested environment=%s", settings.environment)
    return {
        "status": "healthy",
        "environment": settings.environment,
        "service": "h10s-agents",
    }


__all__ = ["router"]

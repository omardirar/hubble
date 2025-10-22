"""Shared FastAPI dependencies for the API layer."""

from __future__ import annotations

import logging
from typing import cast

from fastapi import Depends, HTTPException, Request, status

from h10s.middleware.auth import JWTClaims, get_current_claims
from h10s.models import AppContext

logger = logging.getLogger(__name__)


async def require_authenticated_user(
    claims: JWTClaims = Depends(get_current_claims),  # noqa: B008
) -> JWTClaims:
    """Ensure the request is authenticated and return the JWT claims."""

    if claims is None:  # pragma: no cover - defensive guard
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    logger.debug("Authenticated user dependency resolved subject=%s", claims.sub)
    return claims


def get_app_context(request: Request) -> AppContext:
    """Fetch the application context from app state."""

    context = getattr(request.app.state, "app_context", None)
    if context is None:
        raise RuntimeError("Application context not initialised")
    logger.debug("Retrieved application context for path=%s", request.url.path)
    return cast(AppContext, context)


__all__ = ["AppContext", "get_app_context", "require_authenticated_user"]

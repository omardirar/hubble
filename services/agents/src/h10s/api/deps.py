"""FastAPI dependencies for H10S Agents API."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from h10s.auth import get_auth_context
from h10s.auth.clerk import AuthenticationError
from h10s.config import AppSettings, get_settings
from h10s.db import get_pool
from h10s.db.repositories import InteractionsRepository, MotherDuckRepository
from h10s.schema.domain import AuthContext


async def require_auth(
    authorization: Annotated[str | None, Header()] = None,
    settings: AppSettings = Depends(get_settings),
) -> AuthContext:
    """Dependency to require authentication via Clerk JWT.

    Args:
        authorization: Authorization header with Bearer token
        settings: Application settings

    Returns:
        AuthContext with user_id and org_id

    Raises:
        HTTPException: 401 if authentication fails
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return get_auth_context(authorization, settings)
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


def get_interactions_repo() -> InteractionsRepository:
    """Dependency to get InteractionsRepository."""
    pool = get_pool()
    return InteractionsRepository(pool)


def get_motherduck_repo() -> MotherDuckRepository:
    """Dependency to get MotherDuckRepository."""
    pool = get_pool()
    return MotherDuckRepository(pool)

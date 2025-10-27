"""FastAPI dependencies for H10S Agents API."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from h10s.auth import get_auth_context
from h10s.auth.clerk import AuthenticationError
from h10s.config import AppSettings, get_settings
from h10s.db import get_pool
from h10s.db.repositories import InteractionsRepository, MotherDuckRepository
from h10s.schema.domain import AuthContext

# Security scheme for Swagger UI
bearer_scheme = HTTPBearer(auto_error=False, description="Clerk JWT Token")


async def require_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    settings: AppSettings = Depends(get_settings),
) -> AuthContext:
    """Dependency to require authentication via Clerk JWT.

    Args:
        credentials: HTTP Bearer credentials from Authorization header
        settings: Application settings

    Returns:
        AuthContext with user_id and org_id

    Raises:
        HTTPException: 401 if authentication fails
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Pass the token with Bearer prefix for compatibility
        token = f"Bearer {credentials.credentials}"
        return get_auth_context(token, settings)
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

"""Lightweight wrapper around the Supabase async client."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

import httpx
from supabase import AsyncClient, AsyncClientOptions, acreate_client  # type: ignore[attr-defined]

from h10s.config import AppSettings
from h10s.db.exceptions import DatabaseUnavailableError

_T = TypeVar("_T")

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Async Supabase client wrapper with lazy initialisation."""

    def __init__(self, settings: AppSettings) -> None:
        self._settings = settings
        self._client: AsyncClient | None = None

    async def ensure_ready(self) -> None:
        """Initialise the Supabase client if required."""

        if self._client is None:
            logger.info("Initialising Supabase client for schema 'chat'")
            options = AsyncClientOptions(
                schema="chat",
                postgrest_client_timeout=self._settings.db_timeout_seconds,
                storage_client_timeout=self._settings.db_timeout_seconds,
            )
            self._client = await acreate_client(
                supabase_url=self._settings.supabase_url,
                supabase_key=self._settings.supabase_service_role_key.get_secret_value(),
                options=options,
            )
            logger.debug("Supabase client successfully initialised")
        else:
            logger.debug("Supabase client already initialised; skipping")

    @property
    def client(self) -> AsyncClient:
        """Return the ready Supabase client."""

        if self._client is None:
            raise RuntimeError("Supabase client not initialised")
        return self._client

    async def execute(
        self,
        *,
        description: str,
        operation: Callable[[AsyncClient], Awaitable[_T]],
    ) -> _T:
        """Execute an operation against Supabase with consistent error handling."""

        await self.ensure_ready()

        try:
            logger.debug("Executing Supabase operation: %s", description)
            return await operation(self.client)
        except (httpx.HTTPError, OSError) as exc:
            logger.error("Supabase operation failed: %s error=%s", description, exc)
            raise DatabaseUnavailableError(
                f"Supabase request failed while {description}: {exc}. "
                "Check SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY and network connectivity."
            ) from exc

    async def close(self) -> None:
        """Close existing client connections."""

        if self._client is not None:
            logger.info("Signing out Supabase client session")
            await self._client.auth.sign_out()
            self._client = None
            logger.debug("Supabase client closed")


__all__ = ["SupabaseClient"]

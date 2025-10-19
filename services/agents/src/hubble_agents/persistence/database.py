"""Connection management for Supabase Postgres."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

import asyncpg  # type: ignore[import-untyped]

from ..config.settings import Settings

logger = logging.getLogger(__name__)


T = TypeVar("T")


class SupabaseDatabase:
    """Lightweight asyncpg pool wrapper for Supabase Postgres."""

    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None

    @property
    def pool(self) -> asyncpg.Pool:
        if self._pool is None:  # pragma: no cover - defensive
            raise RuntimeError("Database pool has not been initialised")
        return self._pool

    async def connect(self, settings: Settings) -> None:
        """Initialise the asyncpg pool."""

        if self._pool is not None:
            logger.info("Database pool already connected, skipping initialisation")
            return

        dsn = settings.supabase_db_url.get_secret_value()

        self._pool = await asyncpg.create_pool(  # type: ignore[arg-type]
            dsn=dsn,
            min_size=1,
            max_size=10,
            command_timeout=60,
        )
        logger.info("Connected asyncpg pool to Supabase")

    async def close(self) -> None:
        """Close the pool."""

        if self._pool is not None:
            await self._pool.close()
            logger.info("Closed asyncpg pool")
            self._pool = None

    async def execute(self, query: str, *args: Any) -> None:
        """Execute a statement without returning rows."""
        async with self.pool.acquire() as conn:
            await conn.execute(query, *args)

    async def fetchrow(self, query: str, *args: Any) -> asyncpg.Record | None:
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args: Any) -> Any:
        async with self.pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    async def with_connection(self, func: Callable[[asyncpg.Connection], Awaitable[T]]) -> T:
        """Execute a coroutine with a dedicated connection."""
        async with self.pool.acquire() as conn:
            return await func(conn)


__all__ = ["SupabaseDatabase"]

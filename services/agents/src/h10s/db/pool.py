"""Asyncpg connection pool management."""

from __future__ import annotations

import logging

import asyncpg

from h10s.config import AppSettings

logger = logging.getLogger(__name__)

# Global pool instance
_pool: asyncpg.Pool | None = None


async def init_pool(settings: AppSettings) -> asyncpg.Pool:
    """Initialize the database connection pool.

    Args:
        settings: Application settings with database configuration

    Returns:
        Initialized asyncpg Pool

    Raises:
        Exception: If pool initialization fails
    """
    global _pool

    if _pool is not None:
        logger.warning("Database pool already initialized")
        return _pool

    logger.info("Initializing database connection pool url=%s", settings.supabase_db_url)

    try:
        _pool = await asyncpg.create_pool(
            dsn=settings.supabase_db_url,
            min_size=settings.db_pool_min_size,
            max_size=settings.db_pool_max_size,
            max_inactive_connection_lifetime=settings.db_pool_max_inactive_lifetime,
            command_timeout=60.0,  # 60 second timeout for commands
        )

        logger.info(
            "Database pool initialized min_size=%d max_size=%d",
            settings.db_pool_min_size,
            settings.db_pool_max_size,
        )

        return _pool

    except Exception as e:
        logger.error("Failed to initialize database pool: %s", e, exc_info=True)
        raise


async def close_pool() -> None:
    """Close the database connection pool gracefully."""
    global _pool

    if _pool is None:
        logger.warning("No pool to close")
        return

    logger.info("Closing database connection pool")

    try:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed successfully")
    except Exception as e:
        logger.error("Error closing database pool: %s", e, exc_info=True)
        raise


def get_pool() -> asyncpg.Pool:
    """Get the current database connection pool.

    Returns:
        The initialized asyncpg Pool

    Raises:
        RuntimeError: If pool is not initialized
    """
    if _pool is None:
        raise RuntimeError(
            "Database pool not initialized. Call init_pool() during application startup."
        )

    return _pool

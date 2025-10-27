"""Repository for thread, message, and run operations."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)


class InteractionsRepository:
    """Repository for agent interaction data (threads, messages, runs)."""

    def __init__(self, pool: asyncpg.Pool):
        """Initialize repository with database pool.

        Args:
            pool: Asyncpg connection pool
        """
        self.pool = pool

    # Thread operations
    async def create_thread(
        self,
        org_id: str,
        owner_user_id: str,
        title: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a new thread.

        Args:
            org_id: Organization ID
            owner_user_id: User ID of thread owner
            title: Optional thread title
            metadata: Optional metadata dictionary

        Returns:
            Created thread record as dictionary
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO h10s.threads (org_id, owner_user_id, title, metadata)
                VALUES ($1, $2, $3, $4)
                RETURNING id, org_id, owner_user_id, title, metadata, created_at, updated_at
                """,
                org_id,
                owner_user_id,
                title,
                metadata or {},
            )
            assert row is not None  # INSERT...RETURNING always returns a row
            return dict(row)

    async def get_thread(self, thread_id: UUID, org_id: str) -> dict[str, Any] | None:
        """Get a thread by ID and org.

        Args:
            thread_id: Thread UUID
            org_id: Organization ID (for security check)

        Returns:
            Thread record or None if not found
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, org_id, owner_user_id, title, metadata, created_at, updated_at
                FROM h10s.threads
                WHERE id = $1 AND org_id = $2
                """,
                thread_id,
                org_id,
            )
            return dict(row) if row else None

    # Message operations
    async def create_message(
        self,
        thread_id: UUID,
        org_id: str,
        role: str,
        content: dict[str, Any],
        author_user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a message in a thread.

        Args:
            thread_id: Thread UUID
            org_id: Organization ID
            role: Message role (user/assistant/tool/system)
            content: Message content as JSON
            author_user_id: Optional user ID of message author
            metadata: Optional metadata dictionary

        Returns:
            Created message record
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO h10s.messages (
                    thread_id, org_id, author_user_id, role, content, metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING
                    id, thread_id, org_id, author_user_id,
                    role, content, text_content, metadata, created_at
                """,
                thread_id,
                org_id,
                author_user_id,
                role,
                content,
                metadata or {},
            )
            assert row is not None  # INSERT...RETURNING always returns a row
            return dict(row)

    async def get_messages(
        self,
        thread_id: UUID,
        org_id: str,
        limit: int = 50,
        before_id: UUID | None = None,
    ) -> list[dict[str, Any]]:
        """Get messages for a thread.

        Args:
            thread_id: Thread UUID
            org_id: Organization ID (for security)
            limit: Maximum messages to return
            before_id: Optional message ID for pagination

        Returns:
            List of message records
        """
        async with self.pool.acquire() as conn:
            if before_id:
                rows = await conn.fetch(
                    """
                    SELECT
                        id, thread_id, org_id, author_user_id,
                        role, content, text_content, metadata, created_at
                    FROM h10s.messages
                    WHERE thread_id = $1 AND org_id = $2 AND created_at < (
                        SELECT created_at FROM h10s.messages WHERE id = $3
                    )
                    ORDER BY created_at DESC
                    LIMIT $4
                    """,
                    thread_id,
                    org_id,
                    before_id,
                    limit,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT
                        id, thread_id, org_id, author_user_id,
                        role, content, text_content, metadata, created_at
                    FROM h10s.messages
                    WHERE thread_id = $1 AND org_id = $2
                    ORDER BY created_at DESC
                    LIMIT $3
                    """,
                    thread_id,
                    org_id,
                    limit,
                )

            return [dict(row) for row in rows]

    # Run operations
    async def create_run(
        self,
        thread_id: UUID,
        org_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a new run.

        Args:
            thread_id: Thread UUID
            org_id: Organization ID
            metadata: Optional metadata dictionary

        Returns:
            Created run record
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO h10s.runs (thread_id, org_id, status, metadata)
                VALUES ($1, $2, 'pending', $3)
                RETURNING id, thread_id, org_id, status, started_at, finished_at, error, metadata
                """,
                thread_id,
                org_id,
                metadata or {},
            )
            assert row is not None  # INSERT...RETURNING always returns a row
            return dict(row)

    async def update_run_status(
        self,
        run_id: UUID,
        status: str,
        error: str | None = None,
    ) -> None:
        """Update run status.

        Args:
            run_id: Run UUID
            status: New status (running/completed/failed/cancelled)
            error: Optional error message if failed
        """
        async with self.pool.acquire() as conn:
            if status in ("completed", "failed", "cancelled"):
                await conn.execute(
                    """
                    UPDATE h10s.runs
                    SET status = $1, error = $2, finished_at = NOW()
                    WHERE id = $3
                    """,
                    status,
                    error,
                    run_id,
                )
            else:
                await conn.execute(
                    """
                    UPDATE h10s.runs
                    SET status = $1, error = $2
                    WHERE id = $3
                    """,
                    status,
                    error,
                    run_id,
                )

    async def get_run(self, run_id: UUID, org_id: str) -> dict[str, Any] | None:
        """Get run by ID.

        Args:
            run_id: Run UUID
            org_id: Organization ID (for security)

        Returns:
            Run record or None
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, thread_id, org_id, status, started_at, finished_at, error, metadata
                FROM h10s.runs
                WHERE id = $1 AND org_id = $2
                """,
                run_id,
                org_id,
            )
            return dict(row) if row else None

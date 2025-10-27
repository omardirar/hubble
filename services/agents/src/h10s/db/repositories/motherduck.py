"""Repository for resolving MotherDuck credentials per organization."""

from __future__ import annotations

import logging

import asyncpg

logger = logging.getLogger(__name__)


class MotherDuckRepository:
    """Repository for MotherDuck credential resolution."""

    def __init__(self, pool: asyncpg.Pool):
        """Initialize repository with database pool.

        Args:
            pool: Asyncpg connection pool
        """
        self.pool = pool

    async def get_credentials(self, org_id: str) -> dict[str, str] | None:
        """Get MotherDuck credentials for an organization.

        This resolves the database name and service account token for
        the organization's provisioned MotherDuck instance.

        Args:
            org_id: Organization ID

        Returns:
            Dictionary with 'db_name' and 'token' keys, or None if not provisioned

        Raises:
            Exception: If database query fails
        """
        async with self.pool.acquire() as conn:
            # Get database name from data_destinations
            dest_row = await conn.fetchrow(
                """
                SELECT md_db_name
                FROM connect.data_destinations
                WHERE org_id = $1
                """,
                org_id,
            )

            if not dest_row:
                logger.warning("No MotherDuck destination found for org_id=%s", org_id)
                return None

            md_db_name = dest_row["md_db_name"]

            # Get token from secrets using RPC function
            token = await conn.fetchval(
                """
                SELECT public.get_secret($1, 'md_sa_token')
                """,
                org_id,
            )

            if not token:
                logger.warning(
                    "No MotherDuck token found for org_id=%s db_name=%s", org_id, md_db_name
                )
                return None

            logger.info(
                "Resolved MotherDuck credentials for org_id=%s db_name=%s", org_id, md_db_name
            )

            return {"db_name": md_db_name, "token": token}

    async def build_mcp_headers(self, org_id: str) -> dict[str, str]:
        """Build MCP headers for MotherDuck tool access.

        Args:
            org_id: Organization ID

        Returns:
            Dictionary with MCP headers (x-motherduck-service-secret, x-motherduck-connection)
            Returns empty dict if credentials not found (allows graceful degradation)
        """
        creds = await self.get_credentials(org_id)

        if not creds:
            logger.warning(
                "MotherDuck credentials not available for org_id=%s "
                "- MCP tools will be unavailable",
                org_id,
            )
            return {}

        # Build headers expected by MCP server
        headers = {
            "x-motherduck-service-secret": creds["token"],
            "x-motherduck-connection": f"md:{creds['db_name']}",
        }

        logger.debug("Built MCP headers for org_id=%s db=%s", org_id, creds["db_name"])

        return headers

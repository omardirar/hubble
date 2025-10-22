"""Repository scaffold for run artifacts (files, structured outputs, etc.)."""

from __future__ import annotations

import logging
from typing import Any

from h10s.db.supabase_client import SupabaseClient

logger = logging.getLogger(__name__)


class ArtifactRepository:
    """Placeholder repository handling artifact persistence."""

    def __init__(self, db: SupabaseClient) -> None:
        self._db = db

    async def record_artifact(self, *, run_id: str, payload: dict[str, Any]) -> None:
        """Persist artifact metadata associated with a run.

        TODO: Implement the actual INSERT once the artifacts schema is defined.
        """

        # TODO: insert into chat.artifacts table (not yet defined).
        _ = (run_id, payload)
        logger.debug(
            "Artifact recording not implemented run_id=%s payload_keys=%s",
            run_id,
            list(payload.keys()),
        )

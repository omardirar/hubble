"""Agent execution orchestration service."""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from h10s.crews.base import BaseCrew
from h10s.db.repositories import MessageRepository, RunRepository
from h10s.models.enums import MessageStatus, RunStatus

logger = logging.getLogger(__name__)


class AgentExecutionService:
    """Coordinate crew execution and persistence side-effects."""

    def __init__(
        self,
        messages: MessageRepository,
        runs: RunRepository,
    ) -> None:
        self._messages = messages
        self._runs = runs

    async def execute_crew(
        self,
        *,
        crew: BaseCrew,
        conversation_id: uuid.UUID,
        prompt: str,
        user_message_seq: int,
        run_id: uuid.UUID,
    ) -> str:
        """Execute the crew and persist assistant output."""

        assistant_seq = user_message_seq + 1
        crew_instance = crew.build(prompt)
        logger.info(
            "Executing crew run_id=%s conversation_id=%s user_seq=%s",
            run_id,
            conversation_id,
            user_message_seq,
        )

        try:
            result = await asyncio.to_thread(
                crew_instance.kickoff,
                inputs={
                    "user_prompt": prompt,
                    "_correlation_id": str(run_id),
                },
            )
        except Exception as exc:
            logger.error(
                "Crew execution failed run_id=%s conversation_id=%s error=%s",
                run_id,
                conversation_id,
                exc,
            )
            error_payload: dict[str, Any] = {"message": str(exc)}
            await self._messages.upsert_assistant_message(
                conversation_id=conversation_id,
                run_id=run_id,
                seq=assistant_seq,
                status=MessageStatus.ERROR,
                content={"schema_version": 1, "error": error_payload},
            )
            await self._runs.update_status(
                run_id=run_id,
                status=RunStatus.FAILED,
                content=error_payload,
                conversation_id=conversation_id,
            )
            raise

        logger.debug(
            "Crew completed successfully run_id=%s conversation_id=%s blocks=%s",
            run_id,
            conversation_id,
            1,
        )

        blocks = [
            {
                "type": "assistant_response",
                "text": str(result),
            }
        ]

        await self._messages.upsert_assistant_message(
            conversation_id=conversation_id,
            run_id=run_id,
            seq=assistant_seq,
            status=MessageStatus.COMPLETE,
            content={"schema_version": 1, "blocks": blocks},
        )

        await self._runs.update_status(
            run_id=run_id,
            status=RunStatus.COMPLETE,
            content={"result": str(result)},
            conversation_id=conversation_id,
        )

        logger.info(
            "Crew result persisted run_id=%s conversation_id=%s assistant_seq=%s",
            run_id,
            conversation_id,
            assistant_seq,
        )

        return str(result)


__all__ = ["AgentExecutionService"]

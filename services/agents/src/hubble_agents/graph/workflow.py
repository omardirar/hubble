"""Supervisor workflow for agent execution"""

import time
from collections.abc import AsyncGenerator
from typing import Any

from ..agents.supervisor import run_supervisor_workflow
from ..utils.logging import get_logger

logger = get_logger(__name__)


class IterativeAgentWorkflow:
    """Supervisor workflow using Pydantic AI agent delegation pattern"""

    def __init__(self) -> None:
        # No parameters needed - always use supervisor pattern
        pass

    async def execute(
        self,
        user_message: str,
        conversation_id: str,
        org_id: str,
        user_id: str,
        motherduck_token: str | None = None,
        database_name: str | None = None,
        mcp_server_url: str | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Execute the supervisor workflow with event streaming"""

        try:
            # Emit workflow start event
            yield {
                "event": "workflow_start",
                "data": {
                    "conversation_id": conversation_id,
                    "org_id": org_id,
                    "user_id": user_id,
                    "user_message": user_message,
                    "timestamp": time.time(),
                },
            }

            # Run supervisor workflow
            final_response = await run_supervisor_workflow(
                user_message=user_message,
                conversation_id=conversation_id,
                org_id=org_id,
                user_id=user_id,
                motherduck_token=motherduck_token,
                database_name=database_name,
                mcp_server_url=mcp_server_url,
            )

            # Emit final response
            yield {"event": "final_response", "data": final_response}

            # Emit completion event
            yield {
                "event": "complete",
                "data": {
                    "text": final_response["final_text"],
                    "tokens": final_response["token_usage"],
                    "status": "completed",
                },
            }

        except Exception as e:
            logger.error("Supervisor workflow error", {"error": str(e)})

            # Emit error event
            yield {
                "event": "error",
                "data": {"error": str(e), "error_type": type(e).__name__},
            }

"""Supervisor workflow for agent execution"""

from collections.abc import AsyncGenerator
from typing import Any

from ..agents.supervisor import run_supervisor_workflow_streaming
from ..utils.logging import get_logger

logger = get_logger(__name__)


class IterativeAgentWorkflow:
    """Supervisor workflow using Pydantic AI agent delegation pattern with streaming"""

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
        """Execute the supervisor workflow with true incremental streaming (Phase 3B)

        This method now streams events in real-time as agents execute, providing:
        - TEXT_DELTA: Incremental text chunks for typewriter effects
        - THINKING_DELTA: Incremental thinking/reasoning chunks
        - AGENT_RUN_STARTED/COMPLETED: Agent lifecycle events
        - TOOL_CALL_STARTED/COMPLETED: Tool execution events
        - WORKFLOW_START/COMPLETE: Workflow lifecycle events
        - FINAL: Complete response with all metadata
        """

        try:
            # Stream all events from supervisor workflow
            async for event in run_supervisor_workflow_streaming(
                user_message=user_message,
                conversation_id=conversation_id,
                org_id=org_id,
                user_id=user_id,
                motherduck_token=motherduck_token,
                database_name=database_name,
                mcp_server_url=mcp_server_url,
            ):
                yield event

        except Exception as e:
            logger.error("Supervisor workflow streaming error", {"error": str(e)})

            # Emit error event
            yield {
                "event": "ERROR",
                "data": {"error": str(e), "error_type": type(e).__name__},
            }

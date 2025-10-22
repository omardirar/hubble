"""API request payload models."""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import Field

from h10s.models.base import H10SBaseModel


class AgentStreamRequest(H10SBaseModel):
    """Base request payload used to kick off an agent/crew stream."""

    conversation_id: uuid.UUID = Field(..., description="Conversation identifier")
    org_id: uuid.UUID = Field(..., description="Organisation identifier")
    user_id: uuid.UUID = Field(..., description="End-user identifier")
    prompt: str = Field(..., min_length=1, max_length=50000)
    metadata: dict[str, Any] | None = Field(default=None)


class CopilotStreamRequest(AgentStreamRequest):
    """Copilot-specific stream request (currently aliases AgentStreamRequest)."""

    pass


AgentStreamRequest.model_rebuild(force=True)
CopilotStreamRequest.model_rebuild(force=True)


__all__ = ["AgentStreamRequest", "CopilotStreamRequest"]

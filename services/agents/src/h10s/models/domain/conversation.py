"""Conversation domain models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import ConfigDict, Field

from h10s.models.base import H10SBaseModel
from h10s.models.enums import ConversationStatus


class Conversation(H10SBaseModel):
    """Representation of a persisted conversation record."""

    id: uuid.UUID
    org_id: uuid.UUID
    user_id: uuid.UUID
    title: str = Field(default="New Chat", min_length=1)
    status: ConversationStatus = ConversationStatus.ACTIVE
    last_message_id: uuid.UUID | None = None
    last_run_id: uuid.UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ConversationCreate(H10SBaseModel):
    """Payload used when creating or upserting conversations."""

    conversation_id: uuid.UUID
    org_id: uuid.UUID
    user_id: uuid.UUID
    title: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ConversationUpdate(H10SBaseModel):
    """Partial update payload for conversations."""

    title: str | None = None
    status: ConversationStatus | None = None
    last_message_id: uuid.UUID | None = None
    last_run_id: uuid.UUID | None = None
    metadata: dict[str, Any] | None = None


__all__ = ["Conversation", "ConversationCreate", "ConversationUpdate"]

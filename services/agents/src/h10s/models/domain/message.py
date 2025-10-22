"""Message domain models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import ConfigDict, Field

from h10s.models.base import H10SBaseModel
from h10s.models.enums import MessageStatus

MessageRole = Literal["user", "assistant", "tool"]


class Message(H10SBaseModel):
    """Representation of a persisted chat message."""

    id: uuid.UUID
    conversation_id: uuid.UUID
    run_id: uuid.UUID | None = None
    role: MessageRole
    seq: int
    status: MessageStatus
    content: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class MessageCreate(H10SBaseModel):
    """Payload used for inserting messages."""

    conversation_id: uuid.UUID
    role: MessageRole
    seq: int
    status: MessageStatus
    content: dict[str, Any]
    run_id: uuid.UUID | None = None
    message_id: uuid.UUID | None = None


class MessageUpdate(H10SBaseModel):
    """Patch payload for messages."""

    status: MessageStatus | None = None
    content: dict[str, Any] | None = None
    run_id: uuid.UUID | None = None


__all__ = [
    "Message",
    "MessageCreate",
    "MessageRole",
    "MessageUpdate",
]

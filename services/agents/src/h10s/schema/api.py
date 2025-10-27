"""API request and response models for H10S Agents API."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# Health endpoint models
class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "healthy"
    environment: str
    service: str = "h10s-agents"


# Thread models
class CreateThreadRequest(BaseModel):
    """Request to create a new thread."""

    title: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CreateThreadResponse(BaseModel):
    """Response after creating a thread."""

    id: UUID
    title: str | None
    created_at: datetime


class ThreadResponse(BaseModel):
    """Thread details response."""

    id: UUID
    org_id: str
    owner_user_id: str
    title: str | None
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime


# Message models
class CreateMessageRequest(BaseModel):
    """Request to create a message in a thread."""

    role: str = Field(default="user", pattern="^(user|assistant|system|tool|function)$")
    content: dict[str, Any] = Field(
        ..., description="Message content as JSON (e.g., {text: string})"
    )


class MessageResponse(BaseModel):
    """Message details response."""

    id: UUID
    thread_id: UUID
    role: str
    content: dict[str, Any]
    text_content: str | None
    author_user_id: str | None
    created_at: datetime


class MessagesListResponse(BaseModel):
    """List of messages response."""

    messages: list[MessageResponse]
    has_more: bool = False


# Run models
class CreateRunRequest(BaseModel):
    """Request to create a run."""

    thread_id: UUID
    message: str | None = Field(
        default=None,
        description="Optional message to add before running (shortcut for user message)",
    )
    stream: bool = Field(
        default=True,
        description="If true, immediately stream execution. If false, return run details.",
    )
    metadata: dict[str, Any] = Field(default_factory=dict)


class RunResponse(BaseModel):
    """Run details response."""

    id: UUID
    thread_id: UUID
    status: str
    started_at: datetime
    finished_at: datetime | None = None
    error: str | None = None
    metadata: dict[str, Any]

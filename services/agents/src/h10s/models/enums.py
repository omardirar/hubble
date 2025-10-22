"""Enumerated types for domain and streaming models."""

from __future__ import annotations

from enum import Enum


class RunStatus(str, Enum):
    """Status values for crew runs."""

    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MessageStatus(str, Enum):
    """Status values for chat messages."""

    STREAMING = "streaming"
    COMPLETE = "complete"
    ERROR = "error"
    CANCELLED = "cancelled"


class ConversationStatus(str, Enum):
    """Status values for conversations."""

    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class SSEEventType(str, Enum):
    """Server-sent event type names."""

    CREW_RUN_STARTED = "crew_run.started"
    CREW_RUN_COMPLETED = "crew_run.completed"
    TASK_STARTED = "task.started"
    TASK_COMPLETED = "task.completed"
    AGENT_RUN_STARTED = "agent_run.started"
    AGENT_RUN_COMPLETED = "agent_run.completed"
    BLOCK_STARTED = "block.started"
    BLOCK_DELTA = "block.delta"
    BLOCK_COMPLETED = "block.completed"
    ERROR = "error"


__all__ = [
    "ConversationStatus",
    "MessageStatus",
    "RunStatus",
    "SSEEventType",
]

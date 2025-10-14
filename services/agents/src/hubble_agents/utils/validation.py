"""Validation utilities for event tracking"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class Message(BaseModel):
    """Message in a chat request"""

    role: str
    content: str


class ChatRequest(BaseModel):
    """Chat request model for FastAPI"""

    messages: list[Message]
    org_id: str
    conversation_id: str
    user_id: str
    motherduck_token: str | None = None
    database_name: str | None = None


def validate_uuid(value: str) -> bool:
    """Validate that a string is a valid UUID v4.

    Args:
        value: String to validate

    Returns:
        True if valid UUID, False otherwise
    """
    if not isinstance(value, str):
        return False

    try:
        uuid.UUID(value, version=4)
        return True
    except (ValueError, TypeError):
        return False


def validate_timestamps_utc_aware(timestamps: list[datetime]) -> bool:
    """Validate that all timestamps are UTC timezone-aware.

    Args:
        timestamps: List of datetime objects to validate

    Returns:
        True if all timestamps are UTC-aware, False otherwise
    """
    for ts in timestamps:
        if ts.tzinfo is None or ts.tzinfo.utcoffset(ts) is None:
            return False
    return True


def validate_requested_by(value: str) -> bool:
    """Validate requested_by field values.

    Args:
        value: Value to validate

    Returns:
        True if valid, False otherwise
    """
    return value in ["user", "system", "automation"]


def validate_thinking_visibility(value: str) -> bool:
    """Validate thinking_visibility field values.

    Args:
        value: Value to validate

    Returns:
        True if valid, False otherwise
    """
    return value in ["full", "hidden"]


def validate_routing_confidence(confidence: float) -> bool:
    """Validate routing confidence is in valid range.

    Args:
        confidence: Confidence value to validate

    Returns:
        True if valid, False otherwise
    """
    return isinstance(confidence, int | float) and 0.0 <= confidence <= 1.0


def validate_routing_candidate(candidate: dict[str, Any]) -> bool:
    """Validate routing candidate structure.

    Args:
        candidate: Candidate dict to validate

    Returns:
        True if valid, False otherwise
    """
    required_fields = ["type", "target", "score", "eligible"]
    if not all(field in candidate for field in required_fields):
        return False

    if candidate["type"] not in ["agent", "tool", "mcp_tool"]:
        return False

    if not isinstance(candidate["score"], int | float) or not (
        0.0 <= candidate["score"] <= 1.0
    ):
        return False

    return isinstance(candidate["eligible"], bool)

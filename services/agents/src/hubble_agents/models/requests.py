"""Request models for the agent API

This module contains Pydantic models for API requests, including
chat requests and message structures.
"""

from __future__ import annotations

from pydantic import BaseModel


class Message(BaseModel):
    """Message in a chat request"""

    role: str
    content: str


class ChatRequest(BaseModel):
    """Chat request model for FastAPI endpoints"""

    messages: list[Message]
    org_id: str
    conversation_id: str
    user_id: str
    motherduck_token: str | None = None
    database_name: str | None = None


__all__ = ["ChatRequest", "Message"]

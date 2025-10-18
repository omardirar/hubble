"""Public Pydantic models exposed by the agent service."""

from .requests import ChatRequest, Message

__all__ = ["ChatRequest", "Message"]

"""API routers exposing the Copilot functionality."""

from .chat.copilot import router as copilot_router
from .health import router as health_router

__all__ = ["copilot_router", "health_router"]

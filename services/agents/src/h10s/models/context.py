"""Application context models shared across the service."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from h10s.config import AppSettings
from h10s.db import SupabaseClient
from h10s.db.repositories import (
    ConversationRepository,
    MessageRepository,
    RunRepository,
)
from h10s.listeners import (
    FrontendSSEListener,
    ListenerRegistry,
    MessagePersistenceListener,
    RunLifecycleListener,
)
from h10s.tools import ToolRegistry


@dataclass(slots=True)
class AppContext:
    """Container for application-scoped services."""

    settings: AppSettings
    db: SupabaseClient
    conversations: ConversationRepository
    messages: MessageRepository
    runs: RunRepository
    tools: ToolRegistry
    sse_listener: FrontendSSEListener
    run_listener: RunLifecycleListener
    message_listener: MessagePersistenceListener
    listener_registry: ListenerRegistry
    background_tasks: set[asyncio.Task[Any]] = field(default_factory=set)


__all__ = ["AppContext"]

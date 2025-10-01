from __future__ import annotations

from typing import Callable, Awaitable
from starlette.types import Scope, Receive, Send

from .context import set_current_headers_from_scope


class HeaderCaptureApp:
    """ASGI wrapper that captures request headers into context before delegating."""

    def __init__(self, app: Callable[[Scope, Receive, Send], Awaitable[None]]):
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") in ("http", "websocket"):
            set_current_headers_from_scope(scope)
        await self._app(scope, receive, send)

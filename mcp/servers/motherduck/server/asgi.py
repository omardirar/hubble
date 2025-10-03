from __future__ import annotations

from typing import Awaitable, Callable

from starlette.types import Receive, Scope, Send

from .context import reset_current_headers, set_current_headers_from_scope


class HeaderCaptureApp:
    """ASGI wrapper that captures request headers into context before delegating."""

    def __init__(self, app: Callable[[Scope, Receive, Send], Awaitable[None]]):
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        token = None
        if scope.get("type") in ("http", "websocket"):
            token = set_current_headers_from_scope(scope)
        try:
            await self._app(scope, receive, send)
        finally:
            reset_current_headers(token)

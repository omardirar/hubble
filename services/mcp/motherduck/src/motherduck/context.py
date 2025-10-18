from __future__ import annotations

import contextlib
from collections.abc import Iterable
from contextvars import ContextVar, Token
from typing import Any

_HEADERS_CTX: ContextVar[dict[str, str] | None] = ContextVar(  # type: ignore[assignment]
    "_HEADERS_CTX", default=None
)


def _to_str_dict(pairs: Iterable[tuple[bytes, bytes]] | None) -> dict[str, str]:
    headers: dict[str, str] = {}
    if not pairs:
        return headers
    for k, v in pairs:
        try:
            key = k.decode("latin-1").lower()
            val = v.decode("latin-1")
            headers[key] = val
        except Exception:
            # Skip undecodable header entries silently
            continue
    return headers


def set_current_headers_from_scope(
    scope: dict[str, Any],
) -> Token[dict[str, str] | None]:
    """Capture incoming HTTP headers from ASGI scope into a context variable."""
    if not isinstance(scope, dict):
        return _HEADERS_CTX.set({})
    headers = scope.get("headers")
    if headers is None:
        return _HEADERS_CTX.set({})
    return _HEADERS_CTX.set(_to_str_dict(headers))


def set_current_headers(headers: dict[str, str] | None) -> Token[dict[str, str] | None]:
    if not headers:
        return _HEADERS_CTX.set({})
    # Normalize keys to lower-case for case-insensitive access
    lowered = {k.lower(): v for k, v in headers.items()}
    return _HEADERS_CTX.set(lowered)


def get_current_headers() -> dict[str, str]:
    return _HEADERS_CTX.get() or {}


def reset_current_headers(token: Token[dict[str, str] | None] | None) -> None:
    if token is None:
        return
    # Token no longer valid; ignore to avoid cascading failures
    with contextlib.suppress(LookupError):
        _HEADERS_CTX.reset(token)

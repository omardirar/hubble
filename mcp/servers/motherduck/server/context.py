from __future__ import annotations

from contextvars import ContextVar
from typing import Dict, Iterable, Tuple


_HEADERS_CTX: ContextVar[dict[str, str]] = ContextVar("_HEADERS_CTX", default={})


def _to_str_dict(pairs: Iterable[Tuple[bytes, bytes]] | None) -> dict[str, str]:
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


def set_current_headers_from_scope(scope: dict) -> None:
    """Capture incoming HTTP headers from ASGI scope into a context variable."""
    if not isinstance(scope, dict):
        _HEADERS_CTX.set({})
        return
    headers = scope.get("headers")
    if headers is None:
        _HEADERS_CTX.set({})
        return
    _HEADERS_CTX.set(_to_str_dict(headers))


def set_current_headers(headers: Dict[str, str] | None) -> None:
    if not headers:
        _HEADERS_CTX.set({})
        return
    # Normalize keys to lower-case for case-insensitive access
    lowered = {k.lower(): v for k, v in headers.items()}
    _HEADERS_CTX.set(lowered)


def get_current_headers() -> dict[str, str]:
    return _HEADERS_CTX.get() or {}

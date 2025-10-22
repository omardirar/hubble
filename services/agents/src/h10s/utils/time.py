"""Time-related helpers."""

from __future__ import annotations

from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return the current UTC timestamp."""

    return datetime.now(tz=UTC)


__all__ = ["utc_now"]

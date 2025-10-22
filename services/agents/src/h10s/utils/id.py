"""Identifier helpers."""

from __future__ import annotations

from ulid import ULID


def generate_ulid() -> str:
    """Return a sortable ULID identifier."""

    return str(ULID())


__all__ = ["generate_ulid"]

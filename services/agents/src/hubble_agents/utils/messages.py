"""Helpers to normalise message blocks persisted to Postgres."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def build_user_blocks(text: str) -> Mapping[str, Any]:
    """Represent a user turn as a single text block."""

    return {
        "blocks": [
            {
                "type": "text",
                "text": text,
            }
        ]
    }


def build_assistant_blocks(summary: str, actions: list[str]) -> Mapping[str, Any]:
    """Represent an assistant response with summary text and optional actions."""

    blocks: list[Mapping[str, Any]] = []

    if summary:
        blocks.append({"type": "text", "text": summary})

    if actions:
        blocks.append({"type": "list", "items": actions})

    return {"blocks": blocks or [{"type": "text", "text": ""}]}


__all__ = ["build_assistant_blocks", "build_user_blocks"]

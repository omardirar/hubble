"""Utility helpers for building SSE frames."""

from __future__ import annotations

import json
from typing import Any


def format_sse_event(
    *, event: str, data: dict[str, Any], event_id: str | None = None, retry: int | None = None
) -> str:
    """Format a dict payload into a Server-Sent Event string."""

    lines: list[str] = []
    if retry is not None:
        lines.append(f"retry: {retry}")
    if event_id:
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event}")
    json_payload = json.dumps(data, separators=(",", ":"))
    lines.append(f"data: {json_payload}")
    lines.append("")
    return "\n".join(lines)


__all__ = ["format_sse_event"]

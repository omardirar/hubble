"""JSON validation utilities."""

from __future__ import annotations

import json
from typing import Any

from h10s.config import get_settings


class JSONPayloadTooLargeError(ValueError):
    """Raised when JSON payload exceeds size limits."""

    pass


def validate_and_serialize_json(data: Any, max_size: int | None = None) -> str:
    """
    Serialize data to JSON with size validation.

    Args:
        data: Data to serialize
        max_size: Maximum allowed size in bytes (defaults to settings)

    Returns:
        JSON string

    Raises:
        JSONPayloadTooLargeError: If serialized data exceeds max_size
    """
    if max_size is None:
        settings = get_settings()
        max_size = settings.max_json_payload_size

    serialized = json.dumps(data, separators=(",", ":"))
    size = len(serialized.encode("utf-8"))

    if size > max_size:
        raise JSONPayloadTooLargeError(
            f"JSON payload size ({size} bytes) exceeds limit ({max_size} bytes)"
        )

    return serialized


__all__ = ["JSONPayloadTooLargeError", "validate_and_serialize_json"]

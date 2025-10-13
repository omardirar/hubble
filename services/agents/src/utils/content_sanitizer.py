"""Content sanitization utilities"""

import re
from typing import Any


def sanitize_content(text: str) -> str:
    """Sanitize content by removing/escaping control characters.

    Args:
        text: Raw text content that may contain control characters

    Returns:
        Sanitized text with control characters removed/escaped
    """
    if not isinstance(text, str):
        return str(text)

    # Remove control characters except newlines and tabs
    # Control characters are 0x00-0x1F except 0x09 (tab) and 0x0A (newline)
    sanitized = re.sub(r"[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]", "", text)

    # Ensure valid UTF-8 (basic check)
    try:
        sanitized.encode("utf-8")
    except UnicodeEncodeError:
        # Replace problematic characters
        sanitized = sanitized.encode("utf-8", errors="replace").decode("utf-8")

    return sanitized


def redact_sensitive_keys(
    data: Any, sensitive_keys: list[str] | None = None
) -> tuple[Any, list[str]]:
    """Redact sensitive keys from dict/list structures.

    Args:
        data: Data structure to redact
        sensitive_keys: List of keys to redact (default: common sensitive keys)

    Returns:
        Tuple of (redacted_data, list_of_redacted_fields)
    """
    if sensitive_keys is None:
        sensitive_keys = [
            "api_key",
            "token",
            "secret",
            "password",
            "authorization",
            "bearer",
        ]

    redacted_fields: list[str] = []

    if isinstance(data, dict):
        redacted: dict[str, Any] = {}
        for key, value in data.items():
            if key.lower() in sensitive_keys:
                redacted[key] = "[REDACTED]"
                redacted_fields.append(key)
            else:
                redacted_value, nested_redacted = redact_sensitive_keys(
                    value, sensitive_keys
                )
                redacted[key] = redacted_value
                redacted_fields.extend(nested_redacted)
        return redacted, redacted_fields

    elif isinstance(data, list):
        redacted_list: list[Any] = []
        for item in data:
            redacted_item, nested_redacted = redact_sensitive_keys(item, sensitive_keys)
            redacted_list.append(redacted_item)
            redacted_fields.extend(nested_redacted)
        return redacted_list, redacted_fields

    else:
        return data, redacted_fields

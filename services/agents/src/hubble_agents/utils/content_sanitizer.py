"""Content sanitization utilities with configurable redaction policies"""

import re
from enum import Enum
from typing import Any

from pydantic import BaseModel


class RedactionPolicy(str, Enum):
    """Redaction policy levels"""

    NONE = "none"  # No redaction
    STRICT = "strict"  # Redact all sensitive patterns
    PERMISSIVE = "permissive"  # Only redact secrets, allow metadata


class RedactionConfig(BaseModel):
    """Configuration for content redaction"""

    policy: RedactionPolicy = RedactionPolicy.STRICT
    # Sensitive patterns (regex)
    pii_patterns: list[str] = [
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",  # Email
        r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",  # Phone
        r"\b\d{3}-\d{2}-\d{4}\b",  # SSN
        r"\b(?:\d{4}[-\s]?){3}\d{4}\b",  # Credit card
    ]
    # Sensitive key patterns (case-insensitive substring match)
    sensitive_keys: list[str] = [
        "api_key",
        "apikey",
        "token",
        "secret",
        "password",
        "authorization",
        "bearer",
        "credential",
        "private_key",
        "access_token",
        "refresh_token",
    ]
    # Allowlist keys (never redacted, even if they match sensitive patterns)
    allowlist_keys: list[str] = [
        "token_count",
        "total_tokens",
        "input_tokens",
        "output_tokens",
        "reasoning_tokens",
        "cache_tokens",
        "model_name",
        "provider_name",
        "session_id",
        "request_id",
        "event_id",
        "run_id",
        "conversation_id",
    ]


# Global redaction config (can be overridden per request)
_global_redaction_config = RedactionConfig()


def set_global_redaction_policy(policy: RedactionPolicy) -> None:
    """Set global redaction policy"""
    global _global_redaction_config
    _global_redaction_config.policy = policy


def get_global_redaction_config() -> RedactionConfig:
    """Get global redaction configuration"""
    return _global_redaction_config


def sanitize_content(text: Any) -> str:
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


def redact_pii_patterns(text: str, config: RedactionConfig | None = None) -> str:
    """Redact PII patterns from text

    Args:
        text: Text to redact
        config: Redaction configuration (uses global if None)

    Returns:
        Text with PII patterns redacted
    """
    if config is None:
        config = _global_redaction_config

    if config.policy == RedactionPolicy.NONE:
        return text

    redacted = text
    for pattern in config.pii_patterns:
        redacted = re.sub(pattern, "[PII_REDACTED]", redacted)

    return redacted


def should_redact_key(key: str, config: RedactionConfig | None = None) -> bool:
    """Determine if a key should be redacted

    Args:
        key: Key name to check
        config: Redaction configuration (uses global if None)

    Returns:
        True if key should be redacted
    """
    if config is None:
        config = _global_redaction_config

    if config.policy == RedactionPolicy.NONE:
        return False

    key_lower = key.lower()

    # Check allowlist first (takes precedence)
    if any(allowed in key_lower for allowed in config.allowlist_keys):
        return False

    # Check sensitive patterns
    return any(sensitive in key_lower for sensitive in config.sensitive_keys)


def redact_sensitive_keys(
    data: Any,
    config: RedactionConfig | None = None,
    redact_values: bool = True,
) -> tuple[Any, list[str]]:
    """Redact sensitive keys from dict/list structures with configurable policies.

    Args:
        data: Data structure to redact
        config: Redaction configuration (uses global if None)
        redact_values: If True, also redact PII in string values

    Returns:
        Tuple of (redacted_data, list_of_redacted_fields)
    """
    if config is None:
        config = _global_redaction_config

    if config.policy == RedactionPolicy.NONE:
        return data, []

    redacted_fields: list[str] = []

    if isinstance(data, dict):
        redacted: dict[str, Any] = {}
        for key, value in data.items():
            if should_redact_key(key, config):
                redacted[key] = "[REDACTED]"
                redacted_fields.append(key)
            else:
                # Recursively process nested structures
                redacted_value, nested_redacted = redact_sensitive_keys(
                    value, config, redact_values
                )
                redacted[key] = redacted_value
                redacted_fields.extend(nested_redacted)
        return redacted, redacted_fields

    elif isinstance(data, list):
        redacted_list: list[Any] = []
        for item in data:
            redacted_item, nested_redacted = redact_sensitive_keys(item, config, redact_values)
            redacted_list.append(redacted_item)
            redacted_fields.extend(nested_redacted)
        return redacted_list, redacted_fields

    elif isinstance(data, str) and redact_values:
        # Redact PII patterns in string values
        return redact_pii_patterns(data, config), redacted_fields

    else:
        return data, redacted_fields


def summarize_large_payload(
    data: Any, max_chars: int = 1000, include_structure: bool = True
) -> dict[str, Any]:
    """Create a summary of large payloads for logging/display

    Args:
        data: Data to summarize
        max_chars: Maximum characters in summary
        include_structure: Include type and structure info

    Returns:
        Summary dict with metadata
    """
    summary: dict[str, Any] = {}

    if isinstance(data, dict):
        summary["type"] = "object"
        summary["keys"] = list(data.keys())
        summary["size"] = len(data)
        if include_structure:
            # Include truncated sample
            sample = {k: str(v)[:50] for k, v in list(data.items())[:3]}
            summary["sample"] = sample
    elif isinstance(data, list):
        summary["type"] = "array"
        summary["length"] = len(data)
        if include_structure and data:
            summary["item_type"] = type(data[0]).__name__
    elif isinstance(data, str):
        summary["type"] = "string"
        summary["length"] = len(data)
        summary["preview"] = data[:max_chars]
        if len(data) > max_chars:
            summary["truncated"] = True
    else:
        summary["type"] = type(data).__name__
        try:
            summary["value"] = str(data)[:max_chars]
        except Exception:
            summary["value"] = "<non-serializable>"

    return summary

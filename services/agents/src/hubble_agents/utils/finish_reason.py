"""Finish reason normalization utilities"""

# Canonical mapping from provider-specific finish reasons to standard ones
FINISH_REASON_MAP: dict[str, str] = {
    # Common finish reasons across providers
    "stop": "stop",
    "end_turn": "stop",  # Anthropic
    "max_tokens": "length",
    "length": "length",
    "content_filter": "content_filter",
    "function_call": "tool_calls",  # OpenAI
    "tool_calls": "tool_calls",  # OpenAI
    "tool_use": "tool_calls",  # PydanticAI
}


def normalize_finish_reason(provider_reason: str, provider: str = "unknown") -> str:
    """Normalize provider-specific finish reason to canonical form.

    Args:
        provider_reason: Raw finish reason from provider
        provider: Provider name for context (anthropic, openai, etc.)

    Returns:
        Canonical finish reason string
    """
    if not provider_reason:
        return "unknown"

    # Try exact match first
    if provider_reason in FINISH_REASON_MAP:
        return FINISH_REASON_MAP[provider_reason]

    # Try case-insensitive match for common variations
    provider_reason_lower = provider_reason.lower()
    for key, value in FINISH_REASON_MAP.items():
        if key.lower() == provider_reason_lower:
            return value

    # Return as-is if no mapping found (with provider prefix for debugging)
    return f"unknown_{provider}_{provider_reason}"

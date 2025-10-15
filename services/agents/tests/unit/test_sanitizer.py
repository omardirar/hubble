"""Unit tests for content sanitization"""

from hubble_agents.utils.content_sanitizer import (
    RedactionConfig,
    RedactionPolicy,
    redact_pii_patterns,
    redact_sensitive_keys,
    sanitize_content,
    should_redact_key,
    summarize_large_payload,
)


class TestSanitizeContent:
    """Tests for control character sanitization"""

    def test_sanitize_removes_control_chars(self) -> None:
        """Control characters should be removed"""
        text = "Hello\x00World\x1fTest"
        result = sanitize_content(text)
        assert result == "HelloWorldTest"

    def test_sanitize_preserves_newlines_and_tabs(self) -> None:
        """Newlines and tabs should be preserved"""
        text = "Hello\tWorld\nTest"
        result = sanitize_content(text)
        assert result == "Hello\tWorld\nTest"

    def test_sanitize_handles_non_string(self) -> None:
        """Non-string input should be converted to string"""
        result = sanitize_content(123)
        assert result == "123"


class TestRedactionPolicies:
    """Tests for redaction policy enforcement"""

    def test_redaction_policy_none_skips_all(self) -> None:
        """NONE policy should skip all redaction"""
        config = RedactionConfig(policy=RedactionPolicy.NONE)
        data = {"api_key": "secret123", "token": "abc"}

        result, redacted_fields = redact_sensitive_keys(data, config)

        assert result == data  # No redaction
        assert len(redacted_fields) == 0

    def test_redaction_policy_strict_redacts_sensitive(self) -> None:
        """STRICT policy should redact all sensitive keys"""
        config = RedactionConfig(policy=RedactionPolicy.STRICT)
        data = {"api_key": "secret123", "user_id": "user_123"}

        result, redacted_fields = redact_sensitive_keys(data, config)

        assert result["api_key"] == "[REDACTED]"
        assert result["user_id"] == "user_123"  # Not sensitive
        assert "api_key" in redacted_fields

    def test_allowlist_keys_never_redacted(self) -> None:
        """Allowlisted keys should never be redacted"""
        config = RedactionConfig(
            policy=RedactionPolicy.STRICT,
            sensitive_keys=["token"],
            allowlist_keys=["total_tokens"],
        )
        data = {"token": "secret", "total_tokens": 100}

        result, redacted_fields = redact_sensitive_keys(data, config)

        assert result["token"] == "[REDACTED]"
        assert result["total_tokens"] == 100  # Allowlisted
        assert "total_tokens" not in redacted_fields


class TestPIIRedaction:
    """Tests for PII pattern redaction"""

    def test_redact_email(self) -> None:
        """Email addresses should be redacted"""
        config = RedactionConfig()
        text = "Contact me at user@example.com for details"

        result = redact_pii_patterns(text, config)

        assert "[PII_REDACTED]" in result
        assert "user@example.com" not in result

    def test_redact_phone_number(self) -> None:
        """Phone numbers should be redacted"""
        config = RedactionConfig()
        text = "Call me at 555-123-4567"

        result = redact_pii_patterns(text, config)

        assert "[PII_REDACTED]" in result
        assert "555-123-4567" not in result

    def test_redact_ssn(self) -> None:
        """SSN should be redacted"""
        config = RedactionConfig()
        text = "SSN: 123-45-6789"

        result = redact_pii_patterns(text, config)

        assert "[PII_REDACTED]" in result
        assert "123-45-6789" not in result


class TestShouldRedactKey:
    """Tests for key redaction logic"""

    def test_should_redact_api_key(self) -> None:
        """api_key should be marked for redaction"""
        config = RedactionConfig()
        assert should_redact_key("api_key", config) is True
        assert should_redact_key("API_KEY", config) is True
        assert should_redact_key("myApiKey", config) is True

    def test_should_not_redact_allowlisted(self) -> None:
        """Allowlisted keys should not be redacted"""
        config = RedactionConfig()
        assert should_redact_key("total_tokens", config) is False
        assert should_redact_key("input_tokens", config) is False
        assert should_redact_key("model_name", config) is False

    def test_should_not_redact_normal_keys(self) -> None:
        """Normal keys should not be redacted"""
        config = RedactionConfig()
        assert should_redact_key("user_id", config) is False
        assert should_redact_key("name", config) is False
        assert should_redact_key("email", config) is False  # Pattern match only in values


class TestRedactSensitiveKeys:
    """Tests for recursive key redaction"""

    def test_redact_nested_dict(self) -> None:
        """Nested dictionaries should be recursively redacted"""
        config = RedactionConfig()
        data = {
            "user": {"name": "Alice", "api_key": "secret123"},
            "settings": {"theme": "dark", "token": "abc"},
        }

        result, redacted_fields = redact_sensitive_keys(data, config)

        assert result["user"]["api_key"] == "[REDACTED]"
        assert result["settings"]["token"] == "[REDACTED]"
        assert result["user"]["name"] == "Alice"
        assert len(redacted_fields) == 2

    def test_redact_list_of_dicts(self) -> None:
        """Lists containing dicts should be recursively redacted"""
        config = RedactionConfig()
        data = [
            {"name": "User 1", "api_key": "key1"},
            {"name": "User 2", "password": "pass2"},
        ]

        result, redacted_fields = redact_sensitive_keys(data, config)

        assert result[0]["api_key"] == "[REDACTED]"
        assert result[1]["password"] == "[REDACTED]"
        assert result[0]["name"] == "User 1"
        assert len(redacted_fields) == 2

    def test_redact_string_values_with_pii(self) -> None:
        """String values with PII should be redacted when flag is True"""
        config = RedactionConfig()
        data = {"message": "Contact user@example.com", "name": "Alice"}

        result, _ = redact_sensitive_keys(data, config, redact_values=True)

        assert "[PII_REDACTED]" in result["message"]
        assert "user@example.com" not in result["message"]
        assert result["name"] == "Alice"


class TestSummarizeLargePayload:
    """Tests for payload summarization"""

    def test_summarize_dict(self) -> None:
        """Dict summary should include keys and size"""
        data = {"key1": "value1", "key2": "value2", "key3": "value3"}

        summary = summarize_large_payload(data)

        assert summary["type"] == "object"
        assert summary["keys"] == ["key1", "key2", "key3"]
        assert summary["size"] == 3
        assert "sample" in summary

    def test_summarize_list(self) -> None:
        """List summary should include length"""
        data = [1, 2, 3, 4, 5]

        summary = summarize_large_payload(data)

        assert summary["type"] == "array"
        assert summary["length"] == 5
        assert summary["item_type"] == "int"

    def test_summarize_long_string(self) -> None:
        """Long string should be truncated with marker"""
        data = "a" * 2000

        summary = summarize_large_payload(data, max_chars=100)

        assert summary["type"] == "string"
        assert summary["length"] == 2000
        assert len(summary["preview"]) == 100
        assert summary["truncated"] is True

    def test_summarize_short_string(self) -> None:
        """Short string should not be truncated"""
        data = "Hello World"

        summary = summarize_large_payload(data, max_chars=100)

        assert summary["type"] == "string"
        assert summary["length"] == 11
        assert summary["preview"] == "Hello World"
        assert "truncated" not in summary or summary["truncated"] is False

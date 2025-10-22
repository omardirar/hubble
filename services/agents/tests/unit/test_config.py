"""Tests for configuration and settings validation."""

from __future__ import annotations

import pytest

from h10s.config import AppSettings, validate_environment


def test_jwt_secret_length_validation(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that JWT secret must be at least 64 characters."""
    monkeypatch.setenv("JWT_SECRET", "short")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://test/test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test")

    with pytest.raises(RuntimeError, match="JWT_SECRET must be at least 64 characters"):
        validate_environment()


def test_jwt_secret_entropy_validation(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that JWT secret entropy is validated."""
    # 64 'a' characters has low entropy
    monkeypatch.setenv("JWT_SECRET", "a" * 64)
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://test/test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test")

    with pytest.raises(RuntimeError, match="JWT_SECRET has low entropy"):
        validate_environment()


def test_database_url_required(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that database URL is required."""
    # Use base64-encoded string for high entropy
    import base64

    secret = base64.b64encode(b"x" * 48).decode()  # 64 chars with good entropy
    monkeypatch.setenv("JWT_SECRET", secret)
    monkeypatch.setenv("SUPABASE_DB_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test")

    with pytest.raises(RuntimeError, match="SUPABASE_DB_URL is required"):
        validate_environment()


def test_settings_defaults() -> None:
    """Test default settings values."""
    settings = AppSettings(
        jwt_secret="x" * 64,  # type: ignore
        supabase_db_url="postgresql://test/test",  # type: ignore
        supabase_service_role_key="test",  # type: ignore
    )

    assert settings.environment == "development"
    assert settings.log_level == "INFO"
    assert settings.max_json_payload_size == 500_000


def test_cors_origins_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that CORS origins can be parsed from CSV."""
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000,https://example.com")

    settings = AppSettings(
        jwt_secret="x" * 64,  # type: ignore
        supabase_db_url="postgresql://test/test",  # type: ignore
        supabase_service_role_key="test",  # type: ignore
    )

    assert len(settings.cors_origins) == 2
    assert "http://localhost:3000" in settings.cors_origins
    assert "https://example.com" in settings.cors_origins

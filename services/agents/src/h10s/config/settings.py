"""Application configuration powered by Pydantic settings."""

from __future__ import annotations

import logging
import math
from collections import Counter
from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


def _calculate_entropy(text: str) -> float:
    """Calculate Shannon entropy of a string."""
    if not text:
        return 0.0
    counts = Counter(text)
    length = len(text)
    return -sum((count / length) * math.log2(count / length) for count in counts.values())


def _split_csv(value: str | list[str]) -> list[str]:
    if isinstance(value, list):
        return value
    return [item.strip() for item in value.split(",") if item.strip()]


class AppSettings(BaseSettings):
    """Settings controlling runtime behaviour."""

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_nested_delimiter="__",
        extra="ignore",
    )

    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    # LLM API Keys
    anthropic_api_key: SecretStr = Field(validation_alias="ANTHROPIC_API_KEY")
    openai_api_key: SecretStr | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    llm_model: str = Field(
        default="anthropic/claude-sonnet-4-5-20250929",
        validation_alias="LLM_MODEL",
    )

    jwt_secret: SecretStr = Field(validation_alias="JWT_SECRET")
    jwt_issuer: str | None = Field(default=None, validation_alias="JWT_ISSUER")
    jwt_audience: str | None = Field(default=None, validation_alias="JWT_AUDIENCE")
    jwt_leeway_seconds: int = Field(default=60, validation_alias="JWT_LEEWAY_SECONDS")

    supabase_url: str = Field(validation_alias="SUPABASE_URL")
    supabase_service_role_key: SecretStr = Field(validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_storage_bucket: str = Field(
        default="agent-artifacts", validation_alias="SUPABASE_STORAGE_BUCKET"
    )
    db_timeout_seconds: int = Field(default=30, validation_alias="DB_TIMEOUT_SECONDS")

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        validation_alias="CORS_ORIGINS",
    )
    allowed_hosts: list[str] = Field(
        default_factory=lambda: ["localhost", "127.0.0.1", "testserver"],
        validation_alias="ALLOWED_HOSTS",
    )

    sse_retry_millis: int = Field(default=3000, validation_alias="SSE_RETRY_MILLIS")
    sse_ping_interval_seconds: int = Field(default=15, validation_alias="SSE_PING_INTERVAL_SECONDS")
    sse_event_timeout_seconds: int = Field(
        default=300, validation_alias="SSE_EVENT_TIMEOUT_SECONDS"
    )

    crew_version: str = Field(default="2025-01-01", validation_alias="CREW_VERSION")

    telemetry_endpoint: str | None = Field(
        default=None, validation_alias="OTEL_EXPORTER_OTLP_ENDPOINT"
    )
    telemetry_service_name: str = Field(default="h10s-agents", validation_alias="OTEL_SERVICE_NAME")

    max_request_body_size: int = Field(default=1_000_000, validation_alias="MAX_REQUEST_BODY_SIZE")
    max_json_payload_size: int = Field(default=500_000, validation_alias="MAX_JSON_PAYLOAD_SIZE")

    @field_validator("cors_origins", "allowed_hosts", mode="before")
    @classmethod
    def _ensure_list(cls, value: list[str] | str) -> list[str]:
        return _split_csv(value)


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    """Return cached settings instance."""

    settings = AppSettings()  # type: ignore[call-arg]
    return settings


def reset_settings_cache() -> None:
    """Clear the cached settings instance (useful for tests)."""

    get_settings.cache_clear()


def validate_environment() -> AppSettings:
    """Validate critical configuration requirements."""

    settings = get_settings()

    errors: list[str] = []

    # Validate API keys
    anthropic_key = settings.anthropic_api_key.get_secret_value()
    if not anthropic_key or len(anthropic_key) < 10:
        errors.append(
            "ANTHROPIC_API_KEY is required and must be a valid API key. "
            "Set it in your .env file or environment variables."
        )

    secret_value = settings.jwt_secret.get_secret_value()
    if len(secret_value) < 64:
        errors.append("JWT_SECRET must be at least 64 characters for HMAC security.")
    else:
        # Check entropy - a good 64-char secret should have entropy > 3.5 bits per character
        entropy = _calculate_entropy(secret_value)
        if entropy < 3.5:
            errors.append(
                f"JWT_SECRET has low entropy ({entropy:.2f} bits/char). "
                "Use a cryptographically random value."
            )

    if settings.supabase_url == "":
        errors.append("SUPABASE_URL is required for persistence.")

    if settings.supabase_service_role_key.get_secret_value() == "":
        errors.append("SUPABASE_SERVICE_ROLE_KEY is required for persistence.")

    if errors:
        bullet_list = "\n - ".join(errors)
        raise RuntimeError(f"Invalid environment configuration:\n - {bullet_list}")

    logger.info("Loaded settings environment=%s", settings.environment)
    return settings


__all__ = ["AppSettings", "get_settings", "reset_settings_cache", "validate_environment"]

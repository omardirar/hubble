"""Application configuration for the agents service.

This module defines the runtime settings used across the refactored agent
stack.  The goal is to keep configuration narrowly focused on the values that
actually affect behaviour while still providing a typed, discoverable API for
the rest of the codebase.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from pydantic import AliasChoices, BaseModel, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class ModelSettings(BaseModel):
    """Per-agent model configuration."""

    model: str = Field(
        default="anthropic:claude-sonnet-4-5-20250929",
        description="Fully qualified provider:model identifier understood by pydantic_ai.",
    )
    temperature: float = Field(default=1.0, ge=0.0, le=1.0)
    max_tokens: int = Field(default=4096, ge=512)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    thinking_budget: int | None = Field(
        default=2048,
        description='Optional Anthropic "thinking" budget token amount.',
        ge=1,
    )


class SupabaseSettings(BaseModel):
    """Supabase connection configuration."""

    url: str = Field(
        default="http://localhost:54321",
        validation_alias=AliasChoices("SUPABASE__URL", "SUPABASE_URL"),
    )
    service_key: SecretStr = Field(
        default=SecretStr("dev-service-role"),
        validation_alias=AliasChoices("SUPABASE__SERVICE_KEY", "SUPABASE_SERVICE_KEY"),
    )
    timeout_seconds: int = Field(
        default=10,
        ge=1,
        le=60,
        validation_alias=AliasChoices("SUPABASE__TIMEOUT_SECONDS", "SUPABASE_TIMEOUT"),
    )


class MCPSettings(BaseModel):
    """Minimum configuration required to talk to MCP servers."""

    motherduck_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MCP__MOTHERDUCK_URL", "MCP_MOTHERDUCK_URL"),
    )
    motherduck_token: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("MCP__MOTHERDUCK_TOKEN", "MOTHERDUCK_TOKEN"),
    )
    database_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MCP__DATABASE_NAME", "DATABASE_NAME"),
    )


class Settings(BaseSettings):
    """Primary application settings object."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_nested_delimiter="__",
        extra="ignore",
    )

    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    anthropic_api_key: SecretStr = Field(validation_alias="ANTHROPIC_API_KEY")
    service_auth_secret: SecretStr = Field(validation_alias="SERVICE_AUTH_SECRET")

    dashboard_url: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("DASHBOARD_URL", "SERVICES__DASHBOARD_URL"),
    )

    supervisor: ModelSettings = Field(default_factory=ModelSettings)
    analyst: ModelSettings = Field(
        default_factory=lambda: ModelSettings(
            model="anthropic:claude-sonnet-4-5-20250929",
            temperature=1,
            max_tokens=200000,
            thinking_budget=4096,
        )
    )
    marketer: ModelSettings = Field(
        default_factory=lambda: ModelSettings(
            model="anthropic:claude-haiku-4-5-20251001",
            temperature=0.6,
            max_tokens=8192,
            thinking_budget=None,
        )
    )

    supabase: SupabaseSettings = Field(default_factory=SupabaseSettings)
    mcp: MCPSettings = Field(default_factory=MCPSettings)

    def model_post_init(self, __context: Any) -> None:
        """Normalise model identifiers to include provider prefixes."""
        for model in (self.supervisor, self.analyst, self.marketer):
            if ":" not in model.model:
                # Default to Anthropic models if the provider prefix is omitted.
                model.model = f"anthropic:{model.model}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached Settings instance."""

    return Settings()  # type: ignore[call-arg]


def reset_settings_cache() -> None:
    """Clear the cached Settings instance (useful in tests)."""

    get_settings.cache_clear()


def validate_environment() -> Settings:
    """Validate required runtime configuration and fail fast with a clear error."""

    settings = get_settings()

    errors: list[str] = []
    api_key = settings.anthropic_api_key.get_secret_value()
    if not api_key or api_key.strip() in {"your_key_here", "sk-your-local-key"}:
        errors.append("ANTHROPIC_API_KEY must be set to a real Anthropic key.")

    service_secret = settings.service_auth_secret.get_secret_value()
    if len(service_secret or "") < 32:
        errors.append("SERVICE_AUTH_SECRET must be at least 32 characters.")

    supabase_key = settings.supabase.service_key.get_secret_value()
    if not supabase_key or supabase_key.strip() in {
        "your-service-role-key-here",
        "local-service-role",
    }:
        errors.append("SUPABASE_SERVICE_KEY must be set to a valid service role key.")

    if errors:
        bullet_list = "\n - ".join(errors)
        raise RuntimeError(f"Invalid environment configuration:\n - {bullet_list}")

    return settings

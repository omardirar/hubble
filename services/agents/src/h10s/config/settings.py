"""Minimal application configuration for LangGraph."""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class AppSettings(BaseSettings):
    """Application settings for H10S Agents API and LangGraph copilot."""

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        extra="ignore",
    )

    # Environment
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    # LLM Configuration
    anthropic_api_key: SecretStr = Field(validation_alias="ANTHROPIC_API_KEY")
    llm_model: str = Field(
        default="claude-sonnet-4-5-20250929",
        validation_alias="LLM_MODEL",
    )

    # Supabase Configuration
    supabase_url: str = Field(validation_alias="SUPABASE_URL")
    supabase_db_url: str = Field(validation_alias="SUPABASE_DB_URL")
    supabase_service_role_key: SecretStr = Field(validation_alias="SUPABASE_SERVICE_ROLE_KEY")

    # Database Pool Configuration
    db_pool_min_size: int = Field(default=2, validation_alias="DB_POOL_MIN_SIZE")
    db_pool_max_size: int = Field(default=10, validation_alias="DB_POOL_MAX_SIZE")
    db_pool_max_inactive_lifetime: float = Field(
        default=300.0, validation_alias="DB_POOL_MAX_INACTIVE_LIFETIME"
    )

    # Clerk Authentication
    clerk_publishable_key: str | None = Field(
        default=None, validation_alias="CLERK_PUBLISHABLE_KEY"
    )
    clerk_issuer: str | None = Field(default=None, validation_alias="CLERK_ISSUER")
    clerk_audience: str | None = Field(default=None, validation_alias="CLERK_AUDIENCE")

    # CORS Configuration
    cors_origins: str = Field(default="http://localhost:3000", validation_alias="CORS_ORIGINS")

    # API Configuration
    max_request_body_size: int = Field(default=1_000_000, validation_alias="MAX_REQUEST_BODY_SIZE")
    max_json_payload_size: int = Field(default=500_000, validation_alias="MAX_JSON_PAYLOAD_SIZE")

    # MotherDuck MCP Server Configuration
    mcp_motherduck_url: str = Field(
        default="http://127.0.0.1:8001/mcp",
        validation_alias="MCP_MOTHERDUCK_URL",
    )
    motherduck_token: SecretStr | None = Field(
        default=None,
        validation_alias="MOTHERDUCK_TOKEN",
    )
    motherduck_connection: str | None = Field(
        default=None,
        validation_alias="MOTHERDUCK_CONNECTION",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    """Return cached settings instance."""
    settings = AppSettings()  # type: ignore[call-arg]
    return settings


def validate_environment() -> AppSettings:
    """Validate critical configuration requirements."""
    settings = get_settings()

    # Validate API key
    anthropic_key = settings.anthropic_api_key.get_secret_value()
    if not anthropic_key or len(anthropic_key) < 10:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is required and must be a valid API key. "
            "Set it in your .env file or environment variables."
        )

    # Ensure LangChain/LangGraph SDKs can locate the key
    os.environ.setdefault("ANTHROPIC_API_KEY", anthropic_key)

    logger.info("Settings validated successfully model=%s", settings.llm_model)
    return settings


__all__ = ["AppSettings", "get_settings", "validate_environment"]

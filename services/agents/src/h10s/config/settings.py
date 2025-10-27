"""Minimal application configuration for LangGraph."""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class AppSettings(BaseSettings):
    """Minimal settings for LangGraph copilot."""

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        extra="ignore",
    )

    anthropic_api_key: SecretStr = Field(validation_alias="ANTHROPIC_API_KEY")
    llm_model: str = Field(
        default="claude-sonnet-4-5-20250929",
        validation_alias="LLM_MODEL",
    )

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

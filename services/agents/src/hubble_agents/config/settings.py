"""Runtime configuration for the agents service with persistence and telemetry."""

from __future__ import annotations

import logging
from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Minimal settings required to run the API."""

    model_config = SettingsConfigDict(env_file=".env", env_nested_delimiter="__", extra="ignore")

    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    dashboard_url: str = Field(default="http://localhost:3000", validation_alias="DASHBOARD_URL")

    anthropic_api_key: SecretStr = Field(validation_alias="ANTHROPIC_API_KEY")
    service_auth_secret: SecretStr = Field(validation_alias="SERVICE_AUTH_SECRET")
    supabase_db_url: SecretStr = Field(validation_alias="SUPABASE_DB_URL")
    supabase_service_role_key: SecretStr = Field(validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_storage_bucket: str = Field(
        default="agent-artifacts", validation_alias="SUPABASE_STORAGE_BUCKET"
    )

    otel_endpoint: str | None = Field(default=None, validation_alias="OTEL_EXPORTER_OTLP_ENDPOINT")
    otel_signoz_ingestion_key: SecretStr | None = Field(
        default=None, validation_alias="SIGNOZ_INGESTION_KEY"
    )
    otel_service_name: str = Field(default="agents-backend", validation_alias="OTEL_SERVICE_NAME")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


def reset_settings_cache() -> None:
    get_settings.cache_clear()


def validate_environment() -> Settings:
    settings = get_settings()

    errors: list[str] = []

    if not settings.anthropic_api_key.get_secret_value().strip():
        errors.append("ANTHROPIC_API_KEY must be set to use the configured agents.")

    if len(settings.service_auth_secret.get_secret_value()) < 32:
        errors.append("SERVICE_AUTH_SECRET must be at least 32 characters long.")

    if not settings.supabase_db_url.get_secret_value():
        errors.append("SUPABASE_DB_URL must be configured for persistence.")

    if not settings.supabase_service_role_key.get_secret_value():
        errors.append("SUPABASE_SERVICE_ROLE_KEY must be configured for persistence.")

    if settings.otel_endpoint and not settings.otel_signoz_ingestion_key:
        errors.append(
            "SIGNOZ_INGESTION_KEY must be set when OTEL_EXPORTER_OTLP_ENDPOINT is provided."
        )

    if errors:
        bullet_list = "\n - ".join(errors)
        raise RuntimeError(f"Invalid environment configuration:\n - {bullet_list}")

    logger.info("Loaded settings env=%s", settings.environment)
    return settings

"""Environment validation entry point with comprehensive checks."""

from __future__ import annotations

import logging
import sys
from typing import NoReturn

from h10s.config import AppSettings, validate_environment

logger = logging.getLogger(__name__)


def validate_env() -> AppSettings:
    """Validate environment variables and fail fast with detailed error messages.

    This function performs comprehensive validation of all critical environment
    variables required for the application to function properly. It checks:
    - Required variables are set and non-empty
    - Format validity (URLs, secrets, etc.)
    - Logical consistency between related variables

    Returns:
        AppSettings: Validated settings instance

    Raises:
        SystemExit: If any validation fails, exits with code 1
    """
    try:
        # Run core validation from settings module
        settings = validate_environment()

        # Additional comprehensive validations
        errors: list[str] = []

        # Validate URLs have proper format
        if settings.supabase_url and not settings.supabase_url.startswith(("http://", "https://")):
            errors.append(f"SUPABASE_URL must be a valid HTTP(S) URL, got: {settings.supabase_url}")

        # Validate CORS origins format
        for origin in settings.cors_origins:
            if not origin.startswith(("http://", "https://", "*")):
                errors.append(f"Invalid CORS origin format: {origin}")

        # Validate environment value
        valid_environments = {"development", "staging", "production"}
        if settings.environment not in valid_environments:
            errors.append(
                f"ENVIRONMENT must be one of {valid_environments}, got: {settings.environment}"
            )

        # Validate numeric ranges
        if settings.db_timeout_seconds <= 0:
            errors.append(
                f"DB_TIMEOUT_SECONDS must be positive, got: {settings.db_timeout_seconds}"
            )

        if settings.sse_retry_millis < 1000:
            errors.append(
                f"SSE_RETRY_MILLIS should be >= 1000ms for stable connections, "
                f"got: {settings.sse_retry_millis}"
            )

        if settings.sse_event_timeout_seconds <= 0:
            errors.append(
                f"SSE_EVENT_TIMEOUT_SECONDS must be positive, "
                f"got: {settings.sse_event_timeout_seconds}"
            )

        # Validate max request size
        if settings.max_request_body_size <= 0:
            errors.append(
                f"MAX_REQUEST_BODY_SIZE must be positive, got: {settings.max_request_body_size}"
            )

        # Warn about development-specific settings in production
        if settings.environment == "production" and (
            "localhost" in settings.cors_origins or "*" in settings.cors_origins
        ):
            errors.append("CORS_ORIGINS contains localhost or wildcard in production environment")

        if errors:
            _fail_with_errors(errors)

        # Success message
        logger.info("✓ Environment validation passed (environment=%s)", settings.environment)
        return settings

    except RuntimeError as e:
        # Re-raise validation errors from validate_environment()
        logger.error("✗ Environment validation failed:\n%s", e)
        sys.exit(1)
    except Exception as e:
        # Catch any unexpected errors during validation
        logger.error("✗ Unexpected error during environment validation: %s", e)
        import traceback

        traceback.print_exc()
        sys.exit(1)


def _fail_with_errors(errors: list[str]) -> NoReturn:
    """Print formatted error messages and exit.

    Args:
        errors: List of validation error messages

    Raises:
        SystemExit: Always exits with code 1
    """
    logger.error("✗ Environment validation failed with the following errors:\n")
    for i, error in enumerate(errors, 1):
        logger.error("  %s. %s", i, error)
    logger.error("\nPlease check your .env file or environment variables.")
    sys.exit(1)


__all__ = ["validate_env"]

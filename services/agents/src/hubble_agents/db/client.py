"""Supabase client configuration with centralized settings and connection pooling"""

from supabase import Client, ClientOptions, create_client

from ..config.settings import get_settings

# Singleton client instance
_client: Client | None = None


def get_supabase_client() -> Client:
    """Get or create Supabase client using centralized settings

    Configuration is loaded from environment variables via Settings class.
    See config/settings.py for all available options.

    Connection Pooling:
        - Timeout configurable via SUPABASE_TIMEOUT (default: 10s)
        - Connection reuse enabled via singleton pattern

    Returns:
        Configured Supabase client instance with connection pooling

    Raises:
        ValidationError: If required configuration is missing or invalid
    """
    global _client

    if _client is not None:
        return _client

    # Load settings from centralized configuration
    settings = get_settings()
    db_settings = settings.supabase
    service_key = db_settings.service_key.get_secret_value()

    # Create client with optimized timeouts and connection pooling
    options = ClientOptions(
        postgrest_client_timeout=db_settings.timeout_seconds,
        storage_client_timeout=db_settings.timeout_seconds,
    )

    _client = create_client(db_settings.url, service_key, options=options)

    return _client


def reset_client() -> None:
    """Reset the singleton client instance (useful for testing)"""
    global _client
    _client = None

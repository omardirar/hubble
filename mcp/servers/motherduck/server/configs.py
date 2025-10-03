import os
import re
from typing import Any


def _resolve_log_level(default: str = "INFO") -> str:
    env_level = os.getenv("MOTHERDUCK_LOG_LEVEL") or os.getenv("LOG_LEVEL")
    if not env_level:
        return default
    return env_level.upper()


SERVER_VERSION = "0.6.3"

SERVER_LOCALHOST = "127.0.0.1"

DEFAULT_LOG_LEVEL = _resolve_log_level()

UVICORN_LOGGING_CONFIG: dict[str, Any] = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": "[uvicorn]    %(levelname)s - %(message)s",
            "use_colors": None,
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
        },
    },
    "loggers": {
        "uvicorn": {
            "handlers": ["default"],
            "level": DEFAULT_LOG_LEVEL,
            "propagate": False,
        },
        "uvicorn.error": {"level": DEFAULT_LOG_LEVEL},
    },
}

#
# HTTP/SSE auth + scoping configuration
#


ENV_MOTHERDUCK_TOKEN_KEYS: list[str] = [
    "MOTHERDUCK_TOKEN",
    "motherduck_token",
]


def get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is not None:
        return value
    return default


def get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def resolve_motherduck_token() -> str:
    for key in ENV_MOTHERDUCK_TOKEN_KEYS:
        v = os.getenv(key)
        if v:
            return v
    raise RuntimeError(
        "Missing MotherDuck token: set MOTHERDUCK_TOKEN (preferred) or motherduck_token"
    )


def get_default_limit() -> int:
    raw = os.getenv("DEFAULT_LIMIT", "500")
    try:
        v = int(raw)
        return v if v > 0 else 500
    except Exception:
        return 500


# Allow formats:
# - tenant_db
# - orgslug/tenant_db
# - md:tenant_db
# - md:orgslug/tenant_db
DB_NAME_ALLOWLIST_REGEX = re.compile(r"^(?:md:)?[A-Za-z0-9_]+(?:/[A-Za-z0-9_]+)?$")

# Connection string allowlist for MotherDuck DSNs supplied via headers
MOTHERDUCK_CONNECTION_REGEX = re.compile(
    r"^md:[A-Za-z0-9_./-]+(?:\?[A-Za-z0-9_=&.-]*)?$"
)

MOTHERDUCK_SERVICE_SECRET_HEADERS: tuple[str, ...] = (
    "x-motherduck-service-secret",
    "x-md-service-secret",
)

MOTHERDUCK_CONNECTION_HEADERS: tuple[str, ...] = (
    "x-motherduck-connection",
    "x-md-connection",
)


def validate_http_env_or_raise(transport: str) -> None:
    """Placeholder for HTTP/SSE-specific environment validation."""
    if transport not in ("sse", "stream"):
        return

    # HTTP clients provide MotherDuck credentials per request via custom headers.
    # No mandatory server-side environment variables to validate.

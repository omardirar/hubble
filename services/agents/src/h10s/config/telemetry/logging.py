"""Centralised logging configuration for the agents service."""

from __future__ import annotations

import logging
import logging.config
from typing import Any

from h10s.config import get_settings

_LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
_LOG_DATE_FORMAT = "%Y-%m-%dT%H:%M:%S%z"

_CONFIGURED = False


def _build_logging_config(level: str) -> dict[str, Any]:
    """Return a dictConfig payload using a unified console formatter."""

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": _LOG_FORMAT,
                "datefmt": _LOG_DATE_FORMAT,
            },
            "access": {
                "()": "uvicorn.logging.AccessFormatter",
                "fmt": "%(asctime)s %(levelname)s [%(name)s] %(client_addr)s "
                '"%(request_line)s" %(status_code)s',
                "datefmt": _LOG_DATE_FORMAT,
                "use_colors": False,
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "standard",
                "stream": "ext://sys.stdout",
            },
            "uvicorn.access": {
                "class": "logging.StreamHandler",
                "formatter": "access",
                "stream": "ext://sys.stdout",
            },
            "null": {
                "class": "logging.NullHandler",
            },
        },
        "root": {"handlers": ["console"], "level": level},
        "loggers": {
            "uvicorn": {"handlers": ["null"], "level": "CRITICAL", "propagate": False},
            "uvicorn.error": {"handlers": ["null"], "level": "CRITICAL", "propagate": False},
            "uvicorn.access": {"handlers": ["null"], "level": "CRITICAL", "propagate": False},
            "gunicorn.error": {"handlers": ["null"], "level": "CRITICAL", "propagate": False},
            "gunicorn.access": {"handlers": ["null"], "level": "CRITICAL", "propagate": False},
        },
    }


def configure_logging(force: bool = False) -> None:
    """Apply the logging configuration once (unless forced)."""

    global _CONFIGURED

    if _CONFIGURED and not force:
        return

    settings = get_settings()
    log_level = settings.log_level.upper()

    logging.config.dictConfig(_build_logging_config(log_level))
    logging.captureWarnings(True)
    _CONFIGURED = True


__all__ = ["configure_logging"]

"""Telemetry configuration helpers."""

from __future__ import annotations

from fastapi import FastAPI

from h10s.config import get_settings

from .tracing import configure_tracing


def maybe_configure_tracing(app: FastAPI) -> None:
    """Configure tracing if telemetry settings are present."""

    configure_tracing(app, get_settings())


__all__ = ["maybe_configure_tracing"]

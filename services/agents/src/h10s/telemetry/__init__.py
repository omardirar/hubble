"""Backwards-compatible telemetry exports.

The telemetry helpers now live under ``h10s.config.telemetry`` but legacy imports
may still reference ``h10s.telemetry``. Re-export the public surface so both
paths continue to work.
"""

from __future__ import annotations

from h10s.config.telemetry import configure_logging, maybe_configure_tracing

__all__ = ["configure_logging", "maybe_configure_tracing"]

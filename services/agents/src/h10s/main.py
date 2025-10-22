"""ASGI entrypoint for the H10S Copilot service."""

from __future__ import annotations

import logging

from h10s.app import create_app

logger = logging.getLogger(__name__)

logger.debug("Creating ASGI application via h10s.app.create_app")
app = create_app()
logger.info("ASGI application ready for serving")

__all__ = ["app"]

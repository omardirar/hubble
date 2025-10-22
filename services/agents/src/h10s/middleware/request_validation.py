"""Request validation middleware for H10S API."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RequestSizeMiddleware(BaseHTTPMiddleware):
    """Enforce maximum request body size limits.

    This middleware checks the Content-Length header before processing requests
    to prevent oversized payloads from consuming excessive resources.
    """

    def __init__(self, app, max_body_size: int) -> None:  # type: ignore[no-untyped-def]
        """Initialize the middleware.

        Args:
            app: FastAPI application instance
            max_body_size: Maximum allowed request body size in bytes
        """
        super().__init__(app)
        self.max_body_size = max_body_size
        logger.info("RequestSizeMiddleware initialised max_body_size=%s", max_body_size)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Check request size and forward to next middleware.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in the chain

        Returns:
            HTTP response from downstream handlers

        Raises:
            HTTPException: If request body exceeds maximum size
        """
        content_length = request.headers.get("content-length")

        if content_length:
            try:
                size = int(content_length)
                if size > self.max_body_size:
                    logger.warning(
                        "Rejecting request path=%s size=%s limit=%s",
                        request.url.path,
                        size,
                        self.max_body_size,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=(
                            f"Request body too large: {size} bytes "
                            f"exceeds limit of {self.max_body_size} bytes"
                        ),
                    )
            except ValueError:
                # Invalid Content-Length header - let FastAPI handle it
                logger.debug(
                    "Invalid Content-Length header on path=%s value=%s",
                    request.url.path,
                    content_length,
                )

        logger.debug("Request size within limits path=%s", request.url.path)
        return await call_next(request)


__all__ = ["RequestSizeMiddleware"]

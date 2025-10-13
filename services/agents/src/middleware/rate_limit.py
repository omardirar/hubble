"""Rate limiting middleware"""

import os
import time
from collections import defaultdict

from fastapi import HTTPException, Request


class RateLimiter:
    # WARNING: This is an in-memory rate limiter suitable for
    # single-instance deployments only. For production multi-instance
    # deployments, use Redis or similar distributed store.

    def __init__(self) -> None:
        self.requests: dict[str, list[float]] = defaultdict(list)
        self.max_requests = int(os.getenv("MAX_REQUESTS_PER_MINUTE", "100"))
        self.window = 60  # seconds

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        window_start = now - self.window

        # Clean old requests
        self.requests[key] = [
            req_time for req_time in self.requests[key] if req_time > window_start
        ]

        # Check limit
        if len(self.requests[key]) >= self.max_requests:
            return False

        self.requests[key].append(now)
        return True


rate_limiter = RateLimiter()


async def check_rate_limit(request: Request) -> None:
    """Rate limiting dependency"""
    org_id = request.headers.get("X-Org-Id")
    user_id = request.headers.get("X-User-Id")

    if not org_id or not user_id:
        raise HTTPException(400, "Missing auth headers")

    key = f"{org_id}:{user_id}"

    if not rate_limiter.is_allowed(key):
        raise HTTPException(429, "Rate limit exceeded")

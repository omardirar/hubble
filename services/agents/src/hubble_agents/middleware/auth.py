"""Service-to-service authentication middleware

Authentication flow:
1. Attempt Clerk JWT verification (production)
2. Fallback to HMAC token verification (development/testing)
3. Reject if both fail
"""

import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..config.clerk import (
    ClerkSettings,
    ServiceTokenPayload,
    verify_clerk_jwt_async,
)

# Export ServiceTokenPayload for external use
__all__ = ["ServiceTokenPayload", "get_current_user", "verify_hmac_token"]

security = HTTPBearer()


def verify_hmac_token(token: str) -> ServiceTokenPayload | None:
    """Verify HMAC service token from dashboard (fallback/development)

    This is the legacy authentication method, retained for:
    - Development environments without Clerk
    - Testing scenarios
    - Gradual migration support

    DEPRECATED: Use Clerk JWT in production
    """
    try:
        decoded = base64.b64decode(token).decode("utf-8")
        payload_str, signature = decoded.split(".")

        secret = os.getenv("SERVICE_AUTH_SECRET")
        if not secret:
            return None

        if len(secret) < 32:
            return None

        expected_signature = hmac.new(
            secret.encode(), payload_str.encode(), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_signature):
            return None

        payload_data = json.loads(payload_str)

        # Check token age (5 minutes max)
        age = time.time() * 1000 - payload_data["timestamp"]
        if age > 5 * 60 * 1000:
            return None

        # Convert to ServiceTokenPayload format
        # HMAC tokens don't have JWT standard fields, so we set defaults
        return ServiceTokenPayload(
            org_id=payload_data["orgId"],
            user_id=payload_data["userId"],
            conversation_id=payload_data["conversationId"],
            iss="hmac-fallback",
            sub=payload_data["userId"],
            aud="",
            exp=int(payload_data["timestamp"] / 1000) + 300,  # 5 min from issuance
            iat=int(payload_data["timestamp"] / 1000),
        )
    except Exception:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),  # noqa: B008
) -> ServiceTokenPayload:
    """Dependency to get authenticated user

    Authentication strategy:
    1. Try Clerk JWT verification (if enabled)
    2. Fallback to HMAC verification (if Clerk fails)
    3. Reject if both fail

    Raises:
        HTTPException: 401 if authentication fails
    """
    token = credentials.credentials

    # Load Clerk settings
    clerk_settings = ClerkSettings()

    # Strategy 1: Clerk JWT verification
    if clerk_settings.enabled:
        payload = await verify_clerk_jwt_async(token, clerk_settings)
        if payload:
            return payload

    # Strategy 2: HMAC fallback (development/testing)
    payload = verify_hmac_token(token)
    if payload:
        return payload

    # Both strategies failed
    raise HTTPException(
        status_code=401,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

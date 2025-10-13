"""Service-to-service authentication middleware"""

import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

security = HTTPBearer()


class ServiceTokenPayload(BaseModel):
    org_id: str
    user_id: str
    conversation_id: str
    timestamp: int
    nonce: str


def verify_service_token(token: str) -> ServiceTokenPayload | None:
    """Verify HMAC service token from dashboard"""
    try:
        decoded = base64.b64decode(token).decode("utf-8")
        payload_str, signature = decoded.split(".")

        secret = os.getenv("SERVICE_AUTH_SECRET")
        if not secret:
            raise HTTPException(500, "Service auth not configured")

        if len(secret) < 32:
            raise HTTPException(
                500, "Service auth secret must be at least 32 characters"
            )

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

        return ServiceTokenPayload(
            **{
                "org_id": payload_data["orgId"],
                "user_id": payload_data["userId"],
                "conversation_id": payload_data["conversationId"],
                "timestamp": payload_data["timestamp"],
                "nonce": payload_data["nonce"],
            }
        )
    except Exception:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),  # noqa: B008
) -> ServiceTokenPayload:
    """Dependency to get authenticated user"""
    token = credentials.credentials
    payload = verify_service_token(token)

    if not payload:
        raise HTTPException(401, "Invalid or expired service token")

    return payload

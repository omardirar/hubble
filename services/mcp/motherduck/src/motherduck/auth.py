from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions

from .configs import MOTHERDUCK_SERVICE_SECRET_HEADERS


class AuthError(Exception):
    pass


@dataclass(slots=True)
class MotherDuckAuthContext:
    org_id: str
    user_id: str
    service_secret: str

    @property
    def connection_uri(self) -> str:
        """Build org-scoped MotherDuck connection string."""
        return f"md:md_{self.org_id}"

    @property
    def display_target(self) -> str:
        return f"md:md_{self.org_id}"


def _extract_bearer_token(authorization_header: str | None) -> str:
    """Extract JWT token from Authorization header."""
    if not authorization_header:
        raise AuthError("Missing Authorization header")
    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthError("Invalid Authorization header format")
    return parts[1]


def _first_header(headers: dict[str, str], candidates: tuple[str, ...]) -> str | None:
    """Get first matching header from candidates."""
    for key in candidates:
        value = headers.get(key)
        if value:
            return value.strip()
    return None


def _verify_clerk_jwt(jwt_token: str) -> dict[str, str]:
    """Verify Clerk JWT and extract claims.

    Returns:
        dict with org_id and user_id

    Raises:
        AuthError: If JWT is invalid or missing required claims
    """
    clerk_secret_key = os.getenv("CLERK_SECRET_KEY")
    if not clerk_secret_key:
        raise AuthError("CLERK_SECRET_KEY not configured")

    try:
        clerk = Clerk(bearer_auth=clerk_secret_key)

        # Create a minimal httpx.Request for verification
        request = httpx.Request(
            method="POST",
            url="http://localhost",
            headers={"authorization": f"Bearer {jwt_token}"},
        )

        # Authenticate request with Clerk
        request_state = clerk.authenticate_request(
            request,
            AuthenticateRequestOptions(),
        )

        if not request_state.is_signed_in:
            raise AuthError("Invalid or expired JWT")

        # The token itself contains the claims - decode it
        # Clerk JWTs follow standard JWT format with base64-encoded payload

        # Split JWT into parts
        parts = jwt_token.split(".")
        if len(parts) != 3:
            raise AuthError("Invalid JWT format")

        # Decode payload (add padding if needed)
        payload = parts[1]
        padding = 4 - (len(payload) % 4)
        if padding != 4:
            payload += "=" * padding

        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)

        # Extract org_id from claims
        org_id = claims.get("org_id")
        if not org_id:
            raise AuthError("Missing org_id in JWT claims")

        # Extract user_id (sub claim)
        user_id = claims.get("sub")
        if not user_id:
            raise AuthError("Missing user_id (sub) in JWT")

        return {
            "org_id": org_id,
            "user_id": user_id,
        }
    except AuthError:
        raise
    except Exception as e:
        raise AuthError(f"JWT verification failed: {e}") from e


def verify_and_extract(headers: dict[str, str]) -> MotherDuckAuthContext:
    """Verify Clerk JWT and extract MotherDuck credentials from request headers.

    Requires:
    - Authorization header with Clerk JWT
    - MotherDuck service secret header (X-MotherDuck-Service-Secret or X-MD-Service-Secret)

    Returns:
        MotherDuckAuthContext with org-scoped connection

    Raises:
        AuthError: If authentication fails or required headers are missing
    """
    # Extract and verify Clerk JWT
    authz = headers.get("authorization")
    jwt_token = _extract_bearer_token(authz)
    jwt_claims = _verify_clerk_jwt(jwt_token)

    # Get MotherDuck service secret from headers
    service_secret = _first_header(headers, MOTHERDUCK_SERVICE_SECRET_HEADERS)
    if not service_secret:
        raise AuthError("Missing MotherDuck service secret header")

    return MotherDuckAuthContext(
        org_id=jwt_claims["org_id"],
        user_id=jwt_claims["user_id"],
        service_secret=service_secret,
    )

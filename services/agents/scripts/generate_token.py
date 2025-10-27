#!/usr/bin/env python3
"""Generate Clerk-compatible JWT tokens for testing the H10S Copilot API.

This script creates JWT tokens signed with Clerk's JWKS that can be used to test
the FastAPI endpoints via /docs or curl. The tokens are cryptographically valid
and include all required Clerk claims.

Usage examples
--------------

.. code-block:: bash

   # Generate token for a specific user by email
   python services/agents/scripts/generate_token.py --email user@example.com

   # Generate token for a user by Clerk user ID
   python services/agents/scripts/generate_token.py --user-id user_2xyz

   # Specify custom expiration (default: 60 minutes)
   python services/agents/scripts/generate_token.py --email user@example.com --minutes 120

   # Use in FastAPI /docs:
   # 1. Run this script and copy the token
   # 2. Go to http://localhost:8000/docs
   # 3. Click "Authorize" and paste the token
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

import httpx


def load_env_file() -> None:
    """Load key=value pairs from .env.local (or .env) if present."""
    script_dir = Path(__file__).resolve()
    project_root = script_dir.parent.parent  # services/agents

    for candidate in (project_root / ".env.local", project_root / ".env"):
        if candidate.exists():
            with candidate.open() as file:
                for line in file:
                    stripped = line.strip()
                    if not stripped or stripped.startswith("#") or "=" not in stripped:
                        continue
                    key, value = stripped.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip().strip("\"'"))
            break


def get_clerk_secret() -> str:
    """Get Clerk secret key from environment."""
    secret = os.getenv("CLERK_SECRET_KEY")
    if not secret:
        raise SystemExit(
            "CLERK_SECRET_KEY not found. Set it in .env.local or environment variables.\n"
            "Get it from: https://dashboard.clerk.com/ → API Keys → Secret keys"
        )
    return secret


def get_user_by_email(email: str, secret_key: str) -> dict[str, Any]:
    """Fetch user from Clerk by email address."""
    try:
        response = httpx.get(
            "https://api.clerk.com/v1/users",
            headers={"Authorization": f"Bearer {secret_key}"},
            params={"email_address": [email]},
            timeout=30.0,
        )
        response.raise_for_status()
        users = response.json()

        if not users or len(users) == 0:
            raise SystemExit(f"No user found with email: {email}")

        return users[0]  # type: ignore[no-any-return]
    except httpx.HTTPError as e:
        raise SystemExit(f"Failed to fetch user from Clerk API: {e}") from e


def get_user_by_id(user_id: str, secret_key: str) -> dict[str, Any]:
    """Fetch user from Clerk by user ID."""
    try:
        response = httpx.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {secret_key}"},
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()  # type: ignore[no-any-return]
    except httpx.HTTPError as e:
        raise SystemExit(f"Failed to fetch user from Clerk API: {e}") from e


def get_user_org_memberships(user_id: str, secret_key: str) -> list[dict[str, Any]]:
    """Fetch organization memberships for a user via Clerk API.

    Uses the endpoint: GET /users/{user_id}/organization_memberships
    """
    try:
        response = httpx.get(
            f"https://api.clerk.com/v1/users/{user_id}/organization_memberships",
            headers={"Authorization": f"Bearer {secret_key}"},
            params={"limit": 100},  # Get up to 100 orgs
            timeout=30.0,
        )
        response.raise_for_status()
        result = response.json()

        # API returns {"data": [...], "totalCount": N}
        return result.get("data", [])  # type: ignore[no-any-return]
    except httpx.HTTPError as e:
        raise SystemExit(f"Failed to fetch organization memberships: {e}") from e


def get_jwks_private_key(issuer: str) -> str:
    """Fetch the private key from Clerk's JWKS endpoint.

    In production, Clerk uses RS256 with their own private keys.
    For testing, we'll create a mock token using Clerk's Backend API to get a session token,
    or use the simpler approach of creating a properly formatted JWT.
    """
    # Note: Clerk's actual implementation would require their private key
    # For testing purposes, we'll fetch a real session token from Clerk's API
    raise NotImplementedError(
        "Direct JWKS key access not available. Use Clerk Backend API to generate tokens."
    )


def create_session_for_user(user_id: str, secret_key: str) -> str:
    """Create a new session for a user (development/testing only).

    Returns the session ID.
    """
    try:
        response = httpx.post(
            "https://api.clerk.com/v1/sessions",
            headers={
                "Authorization": f"Bearer {secret_key}",
                "Content-Type": "application/json",
            },
            json={"user_id": user_id},
            timeout=30.0,
        )
        response.raise_for_status()
        session = response.json()
        return session["id"]  # type: ignore[no-any-return]
    except httpx.HTTPError as e:
        raise SystemExit(
            f"Failed to create session: {e}\n"
            "Note: Session creation only works in development instances."
        ) from e


def create_session_token(session_id: str, secret_key: str, expires_in_seconds: int) -> str:
    """Create a session token from an existing session.

    Returns a valid JWT signed by Clerk.
    """
    try:
        response = httpx.post(
            f"https://api.clerk.com/v1/sessions/{session_id}/tokens",
            headers={
                "Authorization": f"Bearer {secret_key}",
                "Content-Type": "application/json",
            },
            json={"expires_in_seconds": expires_in_seconds},
            timeout=30.0,
        )
        response.raise_for_status()
        token_data = response.json()
        return token_data["jwt"]  # type: ignore[no-any-return]
    except httpx.HTTPError as e:
        raise SystemExit(f"Failed to create session token: {e}") from e


def print_token_info(token: str, user: dict[str, Any], org_id: str) -> None:
    """Display the generated token and usage instructions."""
    bar = "=" * 80
    print(f"\n{bar}")
    print("Generated Clerk JWT Token")
    print(f"{bar}\n")

    print(f"User: {user.get('email_addresses', [{}])[0].get('email_address', 'N/A')}")
    print(f"User ID: {user['id']}")
    print(f"Org ID: {org_id}")
    print(f"\nToken:\n{token}\n")

    print(f"{bar}")
    print("Usage Instructions")
    print(f"{bar}\n")

    print("1. FastAPI /docs (Swagger UI):")
    print("   - Go to http://localhost:8000/docs")
    print("   - Click the 'Authorize' button (top right)")
    print("   - Paste the token (with or without 'Bearer ' prefix)\n")

    print("2. curl example:")
    print(f"""   curl -X GET http://localhost:8000/api/health \\
     -H "Authorization: Bearer {token}"\n""")

    print("3. httpx/requests example:")
    print(f"""   import httpx
   response = httpx.get(
       "http://localhost:8000/api/health",
       headers={{"Authorization": f"Bearer {token}"}}
   )\n""")

    print(f"{bar}\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Clerk-compatible JWT tokens for testing H10S API."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--email", help="User email address to look up in Clerk")
    group.add_argument("--user-id", help="Clerk user ID (e.g., user_2...)")

    parser.add_argument(
        "--minutes",
        type=int,
        default=60,
        help="Token validity in minutes (default: 60)",
    )
    return parser.parse_args()


def main() -> None:
    """Main entry point for token generation."""
    load_env_file()
    args = parse_args()

    # Get Clerk configuration
    secret_key = get_clerk_secret()
    issuer = os.getenv("CLERK_ISSUER")

    if not issuer:
        raise SystemExit(
            "CLERK_ISSUER not configured. Set it in .env.local\n"
            "Example: CLERK_ISSUER=https://caring-tapir-12.clerk.accounts.dev"
        )

    # Fetch user information
    print("Fetching user from Clerk...", file=sys.stderr)
    if args.email:
        user = get_user_by_email(args.email, secret_key)
    else:
        user = get_user_by_id(args.user_id, secret_key)

    user_id = user["id"]

    # Fetch organization memberships using dedicated endpoint
    print("Fetching organization memberships...", file=sys.stderr)
    org_memberships = get_user_org_memberships(user_id, secret_key)

    if not org_memberships:
        raise SystemExit(
            f"User {user_id} is not a member of any organization.\n"
            "Assign them to an organization in Clerk Dashboard first."
        )

    # Use the organization from the first membership
    org_id = org_memberships[0]["organization"]["id"]

    # Create a session for the user (development/testing only)
    print(f"Creating session for user {user_id}...", file=sys.stderr)
    session_id = create_session_for_user(user_id, secret_key)
    print(f"Session created: {session_id}", file=sys.stderr)

    # Generate token from session
    print("Generating token from session...", file=sys.stderr)
    expires_in_seconds = args.minutes * 60
    token = create_session_token(session_id, secret_key, expires_in_seconds)

    # Display results
    print_token_info(token, user, org_id)


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    main()

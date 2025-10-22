#!/usr/bin/env python3
"""Generate JWT access tokens for the H10S Copilot API.

The API expects HMAC-SHA256 JWTs signed with ``JWT_SECRET`` and including at least
the following claims:

* ``sub`` – the user identifier
* ``org_id`` – organisation identifier used for multi-tenancy
* ``user_id`` – duplicated subject for convenience
* ``exp`` – expiration timestamp (seconds since epoch)

Optional claims ``aud`` and ``iss`` are validated when the corresponding environment
variables are configured. This script reads configuration from ``.env.local`` (or
``.env`` as a fallback) and allows overriding values via CLI flags.

Usage examples
--------------

.. code-block:: bash

   python services/agents/scripts/generate_token.py \\
       --org-id org_123 --user-id user_456 --minutes 30

   # Override JWT secret and include audience / issuer
   python services/agents/scripts/generate_token.py \\
       --jwt-secret $(openssl rand -base64 64) \\
       --audience your-audience --issuer https://api.example.com
"""  # noqa: RUF002

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Final

DEFAULT_CONVERSATION_ID: Final[str] = "00000000-0000-0000-0000-000000000001"
DEFAULT_ORG_ID: Final[str] = "11111111-2222-3333-4444-555555555555"
DEFAULT_USER_ID: Final[str] = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


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


def require_secret(cli_secret: str | None) -> str:
    """Return the JWT secret from CLI or environment."""

    secret = cli_secret or os.getenv("JWT_SECRET")
    if not secret:
        raise SystemExit(
            "JWT secret not provided. Set JWT_SECRET in .env.local or pass --jwt-secret."
        )
    if len(secret) < 32:
        raise SystemExit("JWT secret must be at least 32 characters for security.")
    return secret


def generate_jwt(
    *,
    org_id: str,
    user_id: str,
    conversation_id: str,
    secret: str,
    issuer: str | None,
    audience: str | None,
    expires_delta: timedelta,
) -> str:
    """Generate a signed JWT compatible with the H10S authentication middleware."""

    now = datetime.now(tz=UTC)
    payload: dict[str, object] = {
        "sub": user_id,
        "user_id": user_id,
        "org_id": org_id,
        "conversation_id": conversation_id,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }

    if issuer:
        payload["iss"] = issuer
    if audience:
        payload["aud"] = audience

    header = {"alg": "HS256", "typ": "JWT"}

    def _b64(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

    header_segment = _b64(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_segment = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))

    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_segment = _b64(signature)

    return f"{header_segment}.{payload_segment}.{signature_segment}"


def print_instructions(token: str, *, org_id: str, user_id: str, conversation_id: str) -> None:
    """Display the generated token alongside example usage commands."""

    bar = "=" * 80
    print(f"\n{bar}\nJWT Token\n{bar}\n")
    print(f"{token}\n")

    print("curl example:\n")
    print(
        f"""curl -X POST http://localhost:8000/api/copilot/stream \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{{
    "prompt": "Plan our June marketing budget.",
    "conversation_id": "{conversation_id}",
    "org_id": "{org_id}",
    "user_id": "{user_id}"
  }}'"""
    )

    print("\nPython requests example:\n")
    print(
        f"""import requests

token = "{token}"

payload = {{
    "prompt": "Plan our June marketing budget.",
    "conversation_id": "{conversation_id}",
    "org_id": "{org_id}",
    "user_id": "{user_id}",
}}

response = requests.post(
    "http://localhost:8000/api/copilot/stream",
    headers={{"Authorization": f"Bearer {{token}}"}},
    json=payload,
)
print(response.status_code, response.text)"""
    )
    print(f"\n{bar}\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate H10S Copilot JWT tokens.")
    parser.add_argument("--org-id", default=DEFAULT_ORG_ID, help="Organisation identifier (UUID).")
    parser.add_argument("--user-id", default=DEFAULT_USER_ID, help="User identifier (UUID).")
    parser.add_argument(
        "--conversation-id",
        default=DEFAULT_CONVERSATION_ID,
        help="Conversation UUID associated with the run.",
    )
    parser.add_argument(
        "--minutes",
        type=int,
        default=15,
        help="Token validity in minutes (default: 15).",
    )
    parser.add_argument(
        "--jwt-secret",
        help="Override JWT secret instead of reading JWT_SECRET from the environment.",
    )
    parser.add_argument(
        "--issuer",
        help="Override issuer claim (defaults to JWT_ISSUER env var if set).",
    )
    parser.add_argument(
        "--audience",
        help="Override audience claim (defaults to JWT_AUDIENCE env var if set).",
    )
    return parser.parse_args()


def main() -> None:
    load_env_file()
    args = parse_args()

    secret = require_secret(args.jwt_secret)
    issuer = args.issuer if args.issuer is not None else os.getenv("JWT_ISSUER")
    audience = args.audience if args.audience is not None else os.getenv("JWT_AUDIENCE")

    try:
        token = generate_jwt(
            org_id=args.org_id,
            user_id=args.user_id,
            conversation_id=args.conversation_id,
            secret=secret,
            issuer=issuer,
            audience=audience,
            expires_delta=timedelta(minutes=args.minutes),
        )
    except Exception as exc:  # pragma: no cover - runtime safety
        raise SystemExit(f"Failed to generate JWT: {exc}") from exc

    print_instructions(
        token,
        org_id=args.org_id,
        user_id=args.user_id,
        conversation_id=args.conversation_id,
    )


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    main()

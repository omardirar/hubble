from __future__ import annotations

from .configs import DB_NAME_ALLOWLIST_REGEX


class AuthError(Exception):
    pass


def _extract_bearer_token(authorization_header: str | None) -> str:
    if not authorization_header:
        raise AuthError("Missing Authorization header")
    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthError("Invalid Authorization header format")
    return parts[1]


def verify_and_extract(headers: dict[str, str]) -> tuple[str, str]:
    """Extract MotherDuck token and database name from headers.

    Returns (motherduck_token, db_name).
    """
    authz = headers.get("authorization")
    x_db = headers.get("x-db-name")

    token = _extract_bearer_token(authz)

    if not x_db:
        raise AuthError("Missing X-Db-Name header")

    if not DB_NAME_ALLOWLIST_REGEX.match(x_db):
        raise AuthError("Invalid db name")

    return token, x_db

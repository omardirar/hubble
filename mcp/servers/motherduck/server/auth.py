from __future__ import annotations

from dataclasses import dataclass

from .configs import (
    DB_NAME_ALLOWLIST_REGEX,
    MOTHERDUCK_CONNECTION_HEADERS,
    MOTHERDUCK_CONNECTION_REGEX,
    MOTHERDUCK_SERVICE_SECRET_HEADERS,
)


class AuthError(Exception):
    pass


@dataclass(slots=True)
class MotherDuckAuthContext:
    service_secret: str
    connection_uri: str

    @property
    def display_target(self) -> str:
        base = self.connection_uri.split("?", 1)[0]
        return base or "md:"


def _extract_bearer_token(authorization_header: str | None) -> str:
    if not authorization_header:
        raise AuthError("Missing Authorization header")
    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthError("Invalid Authorization header format")
    return parts[1]


def _first_header(headers: dict[str, str], candidates: tuple[str, ...]) -> str | None:
    for key in candidates:
        value = headers.get(key)
        if value:
            return value.strip()
    return None


def verify_and_extract(headers: dict[str, str]) -> MotherDuckAuthContext:
    """Extract MotherDuck credentials from request headers."""

    service_secret = _first_header(headers, MOTHERDUCK_SERVICE_SECRET_HEADERS)
    connection_uri = _first_header(headers, MOTHERDUCK_CONNECTION_HEADERS)

    if service_secret or connection_uri:
        if not service_secret:
            raise AuthError("Missing MotherDuck service secret header")
        if not connection_uri:
            raise AuthError("Missing MotherDuck connection header")
        if not MOTHERDUCK_CONNECTION_REGEX.match(connection_uri):
            raise AuthError("Invalid MotherDuck connection string")
        return MotherDuckAuthContext(
            service_secret=service_secret,
            connection_uri=connection_uri,
        )

    # Backwards compatibility: fall back to legacy Authorization/X-Db-Name headers.
    authz = headers.get("authorization")
    x_db = headers.get("x-db-name")

    token = _extract_bearer_token(authz)

    if not x_db:
        raise AuthError("Missing X-Db-Name header")

    if not DB_NAME_ALLOWLIST_REGEX.match(x_db):
        raise AuthError("Invalid db name")

    return MotherDuckAuthContext(
        service_secret=token,
        connection_uri=f"md:{x_db}",
    )

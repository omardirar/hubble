"""JWT authentication helpers for the H10S API."""

from __future__ import annotations

import datetime as dt
import logging
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, cast

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from h10s.config import AppSettings, get_settings

logger = logging.getLogger(__name__)

security = HTTPBearer()


@dataclass(slots=True)
class JWTClaims:
    """Typed representation of JWT claims used for authorization."""

    sub: str
    org_id: str
    user_id: str
    exp: int
    iat: int | None
    aud: str | None
    iss: str | None
    raw: Mapping[str, Any]

    @property
    def expires_at(self) -> dt.datetime:
        """Return the expiration timestamp as a timezone-aware datetime."""

        return dt.datetime.fromtimestamp(self.exp, tz=dt.UTC)


def _decode_token(token: str, settings: AppSettings) -> Mapping[str, Any]:
    """Decode and validate a JWT using HMAC-SHA256."""

    algorithms = ["HS256"]
    secret = settings.jwt_secret.get_secret_value()

    try:
        decoded = jwt.decode(
            token,
            secret,
            algorithms=algorithms,
            audience=settings.jwt_audience if settings.jwt_audience else None,
            issuer=settings.jwt_issuer if settings.jwt_issuer else None,
            leeway=settings.jwt_leeway_seconds,
            options={
                "require": ["sub", "exp"],
                "verify_aud": bool(settings.jwt_audience),
                "verify_iss": bool(settings.jwt_issuer),
            },
        )
    except jwt.exceptions.ExpiredSignatureError as exc:  # type: ignore[attr-defined]
        logger.warning("Authentication token expired for audience=%s", settings.jwt_audience)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token expired.",
        ) from exc
    except jwt.exceptions.InvalidTokenError as exc:  # type: ignore[attr-defined]
        logger.warning("Invalid authentication token presented: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        ) from exc

    logger.debug("JWT decoded successfully for subject=%s", decoded.get("sub"))
    return cast(Mapping[str, Any], decoded)


def _claims_from_payload(payload: Mapping[str, Any]) -> JWTClaims:
    """Map the decoded payload to the JWTClaims dataclass."""

    missing: list[str] = [field for field in ("org_id", "user_id") if field not in payload]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Missing required claim(s): {', '.join(missing)}.",
        )

    try:
        sub = str(payload["sub"])
        org_id = str(payload["org_id"])
        user_id = str(payload["user_id"])
        exp = int(payload["exp"])
    except (KeyError, TypeError, ValueError) as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed authentication token."
        ) from exc

    iat = int(payload["iat"]) if "iat" in payload else None
    aud = str(payload["aud"]) if "aud" in payload else None
    iss = str(payload["iss"]) if "iss" in payload else None

    return JWTClaims(
        sub=sub,
        org_id=org_id,
        user_id=user_id,
        exp=exp,
        iat=iat,
        aud=aud,
        iss=iss,
        raw=payload,
    )


async def get_current_claims(
    credentials: HTTPAuthorizationCredentials = Depends(security),  # noqa: B008
) -> JWTClaims:
    """FastAPI dependency returning the authenticated JWT claims."""

    settings = get_settings()
    logger.debug("Authenticating request using Bearer token")
    payload = _decode_token(credentials.credentials, settings)
    claims = _claims_from_payload(payload)
    logger.info("Authenticated request for subject=%s org_id=%s", claims.sub, claims.org_id)
    return claims


__all__ = ["JWTClaims", "get_current_claims"]

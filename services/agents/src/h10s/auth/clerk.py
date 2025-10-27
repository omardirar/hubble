"""Clerk JWT authentication with JWKS verification."""

from __future__ import annotations

import logging
from typing import Any

import jwt
from jwt import PyJWKClient

from h10s.config import AppSettings
from h10s.schema.domain import AuthContext

logger = logging.getLogger(__name__)

# Global JWKS client cache (initialized per-process)
_jwks_client_cache: dict[str, PyJWKClient] = {}


class AuthenticationError(Exception):
    """Raised when authentication fails."""

    pass


def _get_jwks_client(issuer: str) -> PyJWKClient:
    """Get or create cached JWKS client for the given issuer.

    Args:
        issuer: The Clerk issuer URL (e.g., https://clerk.example.com)

    Returns:
        PyJWKClient instance for the issuer
    """
    if issuer not in _jwks_client_cache:
        # Clerk JWKS URL follows the pattern: {issuer}/.well-known/jwks.json
        jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json"
        logger.info("Initializing JWKS client for issuer=%s jwks_url=%s", issuer, jwks_url)

        _jwks_client_cache[issuer] = PyJWKClient(
            jwks_url,
            cache_keys=True,  # Cache fetched keys
            max_cached_keys=16,  # Reasonable limit for key rotation
        )

    return _jwks_client_cache[issuer]


def verify_clerk_jwt(token: str, settings: AppSettings) -> dict[str, Any]:
    """Verify Clerk JWT token and return decoded claims.

    Args:
        token: The JWT token from Authorization header
        settings: Application settings with Clerk configuration

    Returns:
        Decoded JWT claims dictionary

    Raises:
        AuthenticationError: If token is invalid or verification fails
    """
    if not token:
        raise AuthenticationError("Missing authentication token")

    # Strip 'Bearer ' prefix if present
    if token.startswith("Bearer "):
        token = token[7:]

    # Determine issuer (required for Clerk JWT verification)
    issuer = settings.clerk_issuer
    if not issuer:
        # Fallback: try to extract from token without verification
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
            issuer = unverified.get("iss")
            if not issuer:
                raise AuthenticationError("Unable to determine JWT issuer")
        except Exception as e:
            logger.error("Failed to extract issuer from token: %s", e)
            raise AuthenticationError("Invalid JWT format") from e

    try:
        # Get JWKS client for issuer
        jwks_client = _get_jwks_client(issuer)

        # Get signing key from JWKS
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Verify and decode token
        decode_options: dict[str, Any] = {
            "verify_signature": True,
            "verify_exp": True,
            "verify_iat": True,
            "verify_iss": True,
            "require": ["exp", "iat", "iss", "sub"],
        }

        # Add audience verification if configured
        if settings.clerk_audience:
            decode_options["verify_aud"] = True
            decode_options["audience"] = settings.clerk_audience
        else:
            decode_options["verify_aud"] = False

        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            options=decode_options,
            leeway=60,  # 60 second leeway for clock skew
        )

        logger.debug(
            "JWT verified successfully sub=%s org_id=%s",
            claims.get("sub"),
            claims.get("org_id"),
        )

        return dict(claims)

    except jwt.ExpiredSignatureError as e:
        logger.warning("JWT token expired: %s", e)
        raise AuthenticationError("Token has expired") from e
    except jwt.InvalidIssuerError as e:
        logger.warning("JWT invalid issuer: %s", e)
        raise AuthenticationError("Invalid token issuer") from e
    except jwt.InvalidAudienceError as e:
        logger.warning("JWT invalid audience: %s", e)
        raise AuthenticationError("Invalid token audience") from e
    except jwt.InvalidSignatureError as e:
        logger.warning("JWT invalid signature: %s", e)
        raise AuthenticationError("Invalid token signature") from e
    except jwt.DecodeError as e:
        logger.warning("JWT decode error: %s", e)
        raise AuthenticationError("Invalid token format") from e
    except Exception as e:
        logger.error("JWT verification failed: %s", e, exc_info=True)
        raise AuthenticationError("Token verification failed") from e


def get_auth_context(token: str, settings: AppSettings) -> AuthContext:
    """Extract authentication context from JWT token.

    Args:
        token: The JWT token from Authorization header
        settings: Application settings with Clerk configuration

    Returns:
        AuthContext with user_id and org_id

    Raises:
        AuthenticationError: If token is invalid or missing required claims
    """
    claims = verify_clerk_jwt(token, settings)

    # Extract required claims
    user_id = claims.get("sub")
    org_id = claims.get("org_id")

    if not user_id:
        raise AuthenticationError("Token missing 'sub' claim (user_id)")

    if not org_id:
        raise AuthenticationError("Token missing 'org_id' claim")

    return AuthContext(user_id=user_id, org_id=org_id)

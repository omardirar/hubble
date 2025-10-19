"""Clerk JWT authentication configuration and verification

This module implements Clerk JWT verification using JWKS (JSON Web Key Set)
with caching and clock skew handling for production-grade authentication.
"""

import time

import jwt
from jwt import PyJWKClient
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class ClerkSettings(BaseSettings):
    """Clerk authentication settings from environment"""

    model_config = SettingsConfigDict(env_prefix="CLERK_", case_sensitive=False)

    jwks_url: str = "https://clerk.your-domain.com/.well-known/jwks.json"
    audience: str = ""  # e.g., "hubble-agents"
    issuer: str = ""  # e.g., "https://clerk.your-domain.com"
    clock_skew_seconds: int = 60  # Allow 60s clock skew
    jwks_cache_ttl: int = 604800  # 7 days in seconds
    tenancy_enforcement: bool = True  # Enforce org_id matching
    enabled: bool = True  # Toggle Clerk auth vs fallback


class JWKSCache:
    """In-memory JWKS cache with TTL"""

    def __init__(self, ttl_seconds: int = 604800):
        self._client: PyJWKClient | None = None
        self._created_at: float = 0
        self._ttl = ttl_seconds

    def get_client(self, jwks_url: str) -> PyJWKClient:
        """Get cached JWKS client or create new one"""
        now = time.time()

        # Invalidate if expired or first access
        if self._client is None or (now - self._created_at) > self._ttl:
            self._client = PyJWKClient(
                jwks_url,
                cache_keys=True,
                max_cached_keys=16,
            )
            self._created_at = now

        return self._client


# Global cache instance
_jwks_cache = JWKSCache()


class ServiceTokenPayload(BaseModel):
    """Service token payload with tenant identifiers"""

    org_id: str
    user_id: str
    conversation_id: str
    # Token provenance
    iss: str  # Issuer (Clerk)
    sub: str  # Subject (user ID from Clerk)
    aud: str  # Audience (your app)
    exp: int  # Expiration timestamp
    iat: int  # Issued at timestamp
    # Optional Clerk metadata
    org_role: str | None = None
    org_permissions: list[str] | None = None


def verify_clerk_jwt(
    token: str,
    settings: ClerkSettings | None = None,
) -> ServiceTokenPayload | None:
    """Verify Clerk JWT token and extract payload

    Args:
        token: JWT token string
        settings: Clerk settings (defaults to env settings)

    Returns:
        ServiceTokenPayload if valid, None if invalid

    Verification steps:
    1. Fetch JWKS from Clerk (with caching)
    2. Verify signature using public key
    3. Validate audience, issuer, expiration
    4. Handle clock skew
    5. Extract tenant identifiers
    """
    if settings is None:
        settings = ClerkSettings()

    # If Clerk auth disabled, return None to trigger fallback
    if not settings.enabled:
        return None

    try:
        # Get JWKS client (cached)
        jwks_client = _jwks_cache.get_client(settings.jwks_url)

        # Get signing key from JWKS
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode and verify JWT
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.audience if settings.audience else None,
            issuer=settings.issuer if settings.issuer else None,
            leeway=settings.clock_skew_seconds,  # Clock skew tolerance
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": settings.audience != "",
                "verify_iss": settings.issuer != "",
            },
        )

        # Extract tenant identifiers from Clerk claims
        # Clerk typically stores org_id in custom claims or metadata
        org_id = payload.get("org_id") or payload.get("organizations", [{}])[0].get("id", "")
        user_id = payload.get("sub", "")  # Standard JWT sub claim
        conversation_id = payload.get("conversation_id", "")

        # Require essential tenant identifiers
        if not org_id or not user_id:
            return None

        return ServiceTokenPayload(
            org_id=org_id,
            user_id=user_id,
            conversation_id=conversation_id,
            iss=payload["iss"],
            sub=payload["sub"],
            aud=payload.get("aud", ""),
            exp=payload["exp"],
            iat=payload["iat"],
            org_role=payload.get("org_role"),
            org_permissions=payload.get("org_permissions"),
        )

    except jwt.ExpiredSignatureError:
        # Token expired
        return None
    except jwt.InvalidAudienceError:
        # Audience mismatch
        return None
    except jwt.InvalidIssuerError:
        # Issuer mismatch
        return None
    except jwt.InvalidTokenError:
        # Invalid token (signature, format, etc.)
        return None
    except Exception:
        # Unexpected error - fail closed
        return None


async def verify_clerk_jwt_async(
    token: str,
    settings: ClerkSettings | None = None,
) -> ServiceTokenPayload | None:
    """Async version of verify_clerk_jwt for non-blocking verification

    Note: jwt.decode is CPU-bound, not I/O-bound, so we don't use
    asyncio.to_thread here. JWKS fetch is cached, so network calls
    are infrequent. For high-throughput scenarios, consider running
    verification in a thread pool executor.
    """
    return verify_clerk_jwt(token, settings)


def validate_tenant_match(
    token_payload: ServiceTokenPayload,
    request_org_id: str,
    request_user_id: str,
    request_conversation_id: str,
) -> bool:
    """Validate that request parameters match token claims

    Args:
        token_payload: Verified token payload
        request_org_id: org_id from request
        request_user_id: user_id from request
        request_conversation_id: conversation_id from request

    Returns:
        True if all identifiers match, False otherwise
    """
    return (
        token_payload.org_id == request_org_id
        and token_payload.user_id == request_user_id
        and token_payload.conversation_id == request_conversation_id
    )


def refresh_jwks_cache() -> None:
    """Force refresh of JWKS cache

    Useful for:
    - Key rotation detection
    - Security incident response
    - Scheduled maintenance
    """
    global _jwks_cache
    _jwks_cache = JWKSCache()

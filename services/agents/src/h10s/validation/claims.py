"""Helpers for validating JWT claims against incoming requests."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status

from h10s.middleware.auth import JWTClaims
from h10s.models.api import AgentStreamRequest


def parse_uuid_claim(value: str, claim_name: str) -> uuid.UUID:
    """Parse and validate that a claim value is a UUID."""

    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid {claim_name} claim format",
        ) from exc


def validate_claims_match_request(request: AgentStreamRequest, claims: JWTClaims) -> None:
    """Ensure the JWT claims align with the request payload."""

    claim_org = parse_uuid_claim(claims.org_id, "org_id")
    claim_user = parse_uuid_claim(claims.user_id, "user_id")

    if request.org_id != claim_org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization mismatch",
        )
    if request.user_id != claim_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User mismatch",
        )


__all__ = ["parse_uuid_claim", "validate_claims_match_request"]

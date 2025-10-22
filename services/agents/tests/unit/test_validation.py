"""Tests for validation utilities."""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException

from h10s.middleware.auth import JWTClaims
from h10s.models.api import AgentStreamRequest
from h10s.validation import (
    JSONPayloadTooLargeError,
    PermissionValidator,
    parse_uuid_claim,
    validate_and_serialize_json,
    validate_claims_match_request,
)


def test_validate_and_serialize_json_success() -> None:
    """Test successful JSON serialization with validation."""
    data = {"key": "value", "number": 123}
    result = validate_and_serialize_json(data, max_size=1000)

    assert isinstance(result, str)
    assert '"key":"value"' in result
    assert '"number":123' in result


def test_validate_and_serialize_json_too_large() -> None:
    """Test JSON payload size validation."""
    # Create a payload that's definitely too large
    large_data = {"data": "x" * 10000}

    with pytest.raises(JSONPayloadTooLargeError) as exc_info:
        validate_and_serialize_json(large_data, max_size=100)

    assert "exceeds limit" in str(exc_info.value)


def test_validate_and_serialize_json_uses_default_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that default size limit from settings is used."""
    monkeypatch.setenv("MAX_JSON_PAYLOAD_SIZE", "50")
    monkeypatch.setenv("JWT_SECRET", "a" * 64)
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://test/test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test")

    # Reset settings to pick up new env var
    from h10s.config import reset_settings_cache

    reset_settings_cache()

    # This should use the default limit from settings (50 bytes)
    with pytest.raises(JSONPayloadTooLargeError):
        validate_and_serialize_json({"data": "x" * 100})


def _build_claims(org_id: uuid.UUID, user_id: uuid.UUID) -> JWTClaims:
    exp = 2_000_000_000
    raw = {
        "sub": "user",
        "org_id": str(org_id),
        "user_id": str(user_id),
        "exp": exp,
    }
    return JWTClaims(
        sub="user",
        org_id=str(org_id),
        user_id=str(user_id),
        exp=exp,
        iat=None,
        aud=None,
        iss=None,
        raw=raw,
    )


def test_parse_uuid_claim_success() -> None:
    org_id = uuid.uuid4()
    assert parse_uuid_claim(str(org_id), "org_id") == org_id


def test_parse_uuid_claim_invalid() -> None:
    with pytest.raises(HTTPException) as exc_info:
        parse_uuid_claim("not-a-uuid", "org_id")
    assert exc_info.value.status_code == 401


def test_validate_claims_match_request_success() -> None:
    conversation_id = uuid.uuid4()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()

    request = AgentStreamRequest(
        conversation_id=conversation_id,
        org_id=org_id,
        user_id=user_id,
        prompt="Hello",
    )
    claims = _build_claims(org_id, user_id)

    validate_claims_match_request(request, claims)


def test_validate_claims_match_request_org_mismatch() -> None:
    conversation_id = uuid.uuid4()
    org_id = uuid.uuid4()
    other_org = uuid.uuid4()
    user_id = uuid.uuid4()

    request = AgentStreamRequest(
        conversation_id=conversation_id,
        org_id=org_id,
        user_id=user_id,
        prompt="Hello",
    )
    claims = _build_claims(other_org, user_id)

    with pytest.raises(HTTPException) as exc_info:
        validate_claims_match_request(request, claims)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_permission_validator_calls_repository() -> None:
    conversation_id = uuid.uuid4()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    calls: list[tuple[uuid.UUID, uuid.UUID, uuid.UUID]] = []

    class StubConversationRepository:
        async def assert_access(
            self,
            *,
            conversation_id: uuid.UUID,
            org_id: uuid.UUID,
            user_id: uuid.UUID,
        ) -> None:
            calls.append((conversation_id, org_id, user_id))

    validator = PermissionValidator(StubConversationRepository())  # type: ignore[arg-type]
    await validator.require_conversation_access(
        conversation_id=conversation_id,
        org_id=org_id,
        user_id=user_id,
    )

    assert calls == [(conversation_id, org_id, user_id)]

"""Pytest configuration and fixtures for hubble_agents tests"""

from typing import Any

import pytest


@pytest.fixture
def mock_clerk_settings() -> Any:
    """Mock Clerk settings for testing"""
    from hubble_agents.config.clerk import ClerkSettings

    return ClerkSettings(
        jwks_url="https://test.clerk.com/.well-known/jwks.json",
        audience="test-audience",
        issuer="https://test.clerk.com",
        enabled=True,
    )


@pytest.fixture
def sample_jwt_payload() -> dict[str, Any]:
    """Sample JWT payload for testing"""
    return {
        "iss": "https://test.clerk.com",
        "sub": "user_123",
        "aud": "test-audience",
        "exp": 9999999999,  # Far future
        "iat": 1000000000,
        "org_id": "org_123",
        "user_id": "user_123",
        "conversation_id": "conv_123",
    }


@pytest.fixture
def sample_service_token_payload() -> Any:
    """Sample ServiceTokenPayload for testing"""
    from hubble_agents.config.clerk import ServiceTokenPayload

    return ServiceTokenPayload(
        org_id="org_123",
        user_id="user_123",
        conversation_id="conv_123",
        iss="https://test.clerk.com",
        sub="user_123",
        aud="test-audience",
        exp=9999999999,
        iat=1000000000,
    )

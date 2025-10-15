"""Unit tests for authentication middleware"""

import base64
import hashlib
import hmac
import json
import time
from typing import Any
from unittest.mock import MagicMock, patch

from hubble_agents.config.clerk import (
    ServiceTokenPayload,
    validate_tenant_match,
    verify_clerk_jwt,
)
from hubble_agents.middleware.auth import verify_hmac_token


class TestClerkJWTVerification:
    """Tests for Clerk JWT verification"""

    def test_verify_clerk_jwt_disabled(self, mock_clerk_settings: Any) -> None:
        """When Clerk is disabled, verification should return None"""
        mock_clerk_settings.enabled = False

        result = verify_clerk_jwt("fake_token", mock_clerk_settings)

        assert result is None

    @patch("hubble_agents.config.clerk.jwt.decode")
    @patch("hubble_agents.config.clerk._jwks_cache.get_client")
    def test_verify_clerk_jwt_valid_token(
        self,
        mock_get_client: Any,
        mock_jwt_decode: Any,
        mock_clerk_settings: Any,
        sample_jwt_payload: Any,
    ) -> None:
        """Valid Clerk JWT should be verified successfully"""
        # Mock JWKS client
        mock_signing_key = MagicMock()
        mock_signing_key.key = "fake_key"
        mock_jwks_client = MagicMock()
        mock_jwks_client.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_client.return_value = mock_jwks_client

        # Mock JWT decode
        mock_jwt_decode.return_value = sample_jwt_payload

        result = verify_clerk_jwt("valid_token", mock_clerk_settings)

        assert result is not None
        assert isinstance(result, ServiceTokenPayload)
        assert result.org_id == "org_123"
        assert result.user_id == "user_123"
        assert result.conversation_id == "conv_123"

    @patch("hubble_agents.config.clerk.jwt.decode")
    @patch("hubble_agents.config.clerk._jwks_cache.get_client")
    def test_verify_clerk_jwt_missing_org_id(
        self, mock_get_client: Any, mock_jwt_decode: Any, mock_clerk_settings: Any
    ) -> None:
        """JWT without org_id should fail verification"""
        mock_signing_key = MagicMock()
        mock_signing_key.key = "fake_key"
        mock_jwks_client = MagicMock()
        mock_jwks_client.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_client.return_value = mock_jwks_client

        # Payload missing org_id
        payload = {
            "iss": "https://test.clerk.com",
            "sub": "user_123",
            "aud": "test-audience",
            "exp": 9999999999,
            "iat": 1000000000,
            "user_id": "user_123",
            "conversation_id": "conv_123",
            # org_id missing!
        }
        mock_jwt_decode.return_value = payload

        result = verify_clerk_jwt("token_without_org", mock_clerk_settings)

        assert result is None


class TestHMACFallback:
    """Tests for HMAC token verification (legacy)"""

    def test_verify_hmac_token_valid(self) -> None:
        """Valid HMAC token should be verified"""
        # Create HMAC token
        payload = {
            "orgId": "org_123",
            "userId": "user_123",
            "conversationId": "conv_123",
            "timestamp": int(time.time() * 1000),
            "nonce": "test_nonce",
        }
        payload_str = json.dumps(payload)
        secret = "a" * 32  # Min 32 chars

        signature = hmac.new(secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()

        token = base64.b64encode(f"{payload_str}.{signature}".encode()).decode("utf-8")

        with patch.dict("os.environ", {"SERVICE_AUTH_SECRET": secret}):
            result = verify_hmac_token(token)

        assert result is not None
        assert result.org_id == "org_123"
        assert result.user_id == "user_123"
        assert result.conversation_id == "conv_123"

    def test_verify_hmac_token_expired(self) -> None:
        """Expired HMAC token should fail verification"""
        # Create expired token (6 minutes old)
        payload = {
            "orgId": "org_123",
            "userId": "user_123",
            "conversationId": "conv_123",
            "timestamp": int((time.time() - 360) * 1000),  # 6 minutes ago
            "nonce": "test_nonce",
        }
        payload_str = json.dumps(payload)
        secret = "a" * 32

        signature = hmac.new(secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()

        token = base64.b64encode(f"{payload_str}.{signature}".encode()).decode("utf-8")

        with patch.dict("os.environ", {"SERVICE_AUTH_SECRET": secret}):
            result = verify_hmac_token(token)

        assert result is None

    def test_verify_hmac_token_invalid_signature(self) -> None:
        """HMAC token with invalid signature should fail"""
        payload = {
            "orgId": "org_123",
            "userId": "user_123",
            "conversationId": "conv_123",
            "timestamp": int(time.time() * 1000),
            "nonce": "test_nonce",
        }
        payload_str = json.dumps(payload)

        # Wrong signature
        token = base64.b64encode(f"{payload_str}.wrong_signature".encode()).decode("utf-8")

        with patch.dict("os.environ", {"SERVICE_AUTH_SECRET": "a" * 32}):
            result = verify_hmac_token(token)

        assert result is None


class TestTenantValidation:
    """Tests for tenant matching validation"""

    def test_validate_tenant_match_success(self, sample_service_token_payload: Any) -> None:
        """Matching tenant identifiers should pass validation"""
        result = validate_tenant_match(
            sample_service_token_payload, "org_123", "user_123", "conv_123"
        )

        assert result is True

    def test_validate_tenant_match_org_mismatch(self, sample_service_token_payload: Any) -> None:
        """Mismatched org_id should fail validation"""
        result = validate_tenant_match(
            sample_service_token_payload, "org_456", "user_123", "conv_123"
        )

        assert result is False

    def test_validate_tenant_match_user_mismatch(self, sample_service_token_payload: Any) -> None:
        """Mismatched user_id should fail validation"""
        result = validate_tenant_match(
            sample_service_token_payload, "org_123", "user_456", "conv_123"
        )

        assert result is False

    def test_validate_tenant_match_conversation_mismatch(
        self, sample_service_token_payload: Any
    ) -> None:
        """Mismatched conversation_id should fail validation"""
        result = validate_tenant_match(
            sample_service_token_payload, "org_123", "user_123", "conv_456"
        )

        assert result is False

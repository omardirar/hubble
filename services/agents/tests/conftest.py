"""Pytest configuration and fixtures for h10s tests."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncGenerator, Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from h10s.app import create_app
from h10s.config import reset_settings_cache
from h10s.db import SupabaseClient
from h10s.middleware import JWTClaims


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    """Use asyncio backend for async tests."""
    return "asyncio"


@pytest.fixture(autouse=True)
def reset_settings() -> Generator[None, None, None]:
    """Reset settings cache between tests."""
    yield
    reset_settings_cache()


@pytest.fixture
def test_jwt_claims() -> JWTClaims:
    """Create test JWT claims."""
    return JWTClaims(
        sub="test-user-id",
        org_id="test-org-id",
        user_id="test-user-id",
        exp=9999999999,  # Far future
        iat=1234567890,
        aud=None,
        iss=None,
        raw={"sub": "test-user-id", "org_id": "test-org-id", "user_id": "test-user-id"},
    )


@pytest.fixture
def test_conversation_id() -> uuid.UUID:
    """Create a test conversation ID."""
    return uuid.UUID("12345678-1234-5678-1234-567812345678")


@pytest.fixture
def test_org_id() -> uuid.UUID:
    """Create a test organization ID."""
    return uuid.UUID("87654321-4321-8765-4321-876543218765")


@pytest.fixture
def test_user_id() -> uuid.UUID:
    """Create a test user ID."""
    return uuid.UUID("11111111-1111-1111-1111-111111111111")


@pytest.fixture
def mock_jwt_token() -> str:
    """Create a mock JWT token for testing."""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature"


@pytest.fixture
def test_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Create a FastAPI test client with mocked dependencies."""
    # Mock environment variables for testing
    monkeypatch.setenv("JWT_SECRET", "a" * 64)  # 64 chars but low entropy
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://test:test@localhost/test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key")
    monkeypatch.setenv("ENVIRONMENT", "test")

    # Skip validation for tests
    monkeypatch.setenv("SKIP_VALIDATION", "true")

    app = create_app()

    app_context = app.state.app_context

    supabase_client: SupabaseClient = app_context.db
    supabase_client.ensure_ready = AsyncMock()  # type: ignore[assignment]
    supabase_client.close = AsyncMock()  # type: ignore[assignment]
    supabase_client._client = MagicMock()

    app_context.conversations.ensure_conversation = AsyncMock()  # type: ignore[assignment]
    app_context.conversations.assert_access = AsyncMock()  # type: ignore[assignment]
    app_context.messages.create_user_message = AsyncMock(return_value=(uuid.uuid4(), 1))  # type: ignore[assignment]
    app_context.messages.upsert_assistant_message = AsyncMock(return_value=uuid.uuid4())  # type: ignore[assignment]
    app_context.runs.update_status = AsyncMock()  # type: ignore[assignment]
    app_context.message_listener.ensure_user_message = AsyncMock(return_value=(uuid.uuid4(), 1))  # type: ignore[assignment]
    app_context.message_listener.update_assistant_message = AsyncMock(return_value=uuid.uuid4())  # type: ignore[assignment]
    app_context.run_listener.record_run_start = AsyncMock()  # type: ignore[assignment]
    app_context.run_listener.record_run_completion = AsyncMock()  # type: ignore[assignment]
    app_context.sse_listener.create_pending_stream = AsyncMock(return_value=asyncio.Queue())  # type: ignore[assignment]

    return TestClient(app)


@pytest.fixture
async def async_test_client(monkeypatch: pytest.MonkeyPatch) -> AsyncGenerator[Any, None]:
    """Create an async test client for testing async endpoints."""
    from httpx import AsyncClient

    monkeypatch.setenv("JWT_SECRET", "a" * 64)
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://test:test@localhost/test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key")
    monkeypatch.setenv("ENVIRONMENT", "test")

    app = create_app()

    app_context = app.state.app_context

    supabase_client: SupabaseClient = app_context.db
    supabase_client.ensure_ready = AsyncMock()  # type: ignore[assignment]
    supabase_client.close = AsyncMock()  # type: ignore[assignment]
    supabase_client._client = MagicMock()

    app_context.conversations.ensure_conversation = AsyncMock()  # type: ignore[assignment]
    app_context.conversations.assert_access = AsyncMock()  # type: ignore[assignment]
    app_context.messages.create_user_message = AsyncMock(return_value=(uuid.uuid4(), 1))  # type: ignore[assignment]
    app_context.messages.upsert_assistant_message = AsyncMock(return_value=uuid.uuid4())  # type: ignore[assignment]
    app_context.runs.update_status = AsyncMock()  # type: ignore[assignment]
    app_context.message_listener.ensure_user_message = AsyncMock(return_value=(uuid.uuid4(), 1))  # type: ignore[assignment]
    app_context.message_listener.update_assistant_message = AsyncMock(return_value=uuid.uuid4())  # type: ignore[assignment]
    app_context.run_listener.record_run_start = AsyncMock()  # type: ignore[assignment]
    app_context.run_listener.record_run_completion = AsyncMock()  # type: ignore[assignment]
    app_context.sse_listener.create_pending_stream = AsyncMock(return_value=asyncio.Queue())  # type: ignore[assignment]

    async with AsyncClient(app=app, base_url="http://test") as client:  # type: ignore[call-arg]
        yield client


@pytest.fixture
def sample_copilot_request(
    test_conversation_id: uuid.UUID,
    test_org_id: uuid.UUID,
    test_user_id: uuid.UUID,
) -> dict[str, Any]:
    """Create a sample copilot request payload."""
    return {
        "conversation_id": str(test_conversation_id),
        "org_id": str(test_org_id),
        "user_id": str(test_user_id),
        "prompt": "Create a marketing campaign for Q1",
        "metadata": {"title": "Q1 Planning"},
    }


@pytest.fixture
def mock_crew() -> MagicMock:
    """Create a mock CrewAI crew."""
    mock = MagicMock()
    mock.kickoff = MagicMock(return_value="Mock crew response")
    mock.name = "test_crew"
    return mock

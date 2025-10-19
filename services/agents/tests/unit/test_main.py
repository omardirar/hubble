from __future__ import annotations

from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from hubble_agents.main import app, crew_factory, database, run_service
from hubble_agents.middleware.auth import ServiceTokenPayload, get_current_user
from hubble_agents.middleware.rate_limit import check_rate_limit
from hubble_agents.runtime.crew_run import CrewRunOutcome, StreamEvent


@pytest.fixture()
def client(monkeypatch):
    async def kickoff_async(*_args, **_kwargs):
        return SimpleNamespace(
            tasks_output=[
                SimpleNamespace(pydantic=SimpleNamespace(summary="Done", actions=["Act"]))
            ],
            raw="Done",
            token_usage=SimpleNamespace(total_tokens=42),
        )

    monkeypatch.setattr(crew_factory, "crew", lambda: SimpleNamespace(kickoff_async=kickoff_async))

    async def noop_connect(_settings):
        return None

    async def noop_close():
        return None

    monkeypatch.setattr(database, "connect", noop_connect)
    monkeypatch.setattr(database, "close", noop_close)

    async def fake_run(*_args, **_kwargs):
        return CrewRunOutcome(
            status="succeeded",
            summary="Done",
            actions=["Act"],
            raw="Done",
            tokens=42,
        )

    monkeypatch.setattr(run_service, "run", fake_run)

    app.dependency_overrides[get_current_user] = lambda: ServiceTokenPayload(
        org_id="org-1",
        user_id="user-1",
        conversation_id="conv-1",
        iss="local",
        sub="user-1",
        aud="test",
        exp=9999999999,
        iat=0,
    )
    app.dependency_overrides[check_rate_limit] = lambda: None

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_chat_response_returns_structured(client: TestClient) -> None:
    payload = {
        "messages": [{"role": "user", "content": "Please help"}],
        "org_id": "org-1",
        "conversation_id": "conv-1",
        "user_id": "user-1",
    }

    response = client.post("/api/chat", json=payload, headers={"Authorization": "Bearer dev"})

    assert response.status_code == 200
    body = response.json()
    assert body["summary"] == "Done"
    assert body["actions"] == ["Act"]
    assert body["tokens"] == 42


def test_chat_response_requires_message(client: TestClient) -> None:
    payload = {
        "messages": [],
        "org_id": "org-1",
        "conversation_id": "conv-1",
        "user_id": "user-1",
    }

    response = client.post("/api/chat", json=payload, headers={"Authorization": "Bearer dev"})

    assert response.status_code == 400


def test_chat_stream_returns_sse(client: TestClient, monkeypatch: MonkeyPatch) -> None:
    async def fake_stream(
        _request: Any, _user: ServiceTokenPayload
    ) -> tuple[SimpleNamespace, AsyncIterator[StreamEvent]]:
        async def iterator() -> AsyncIterator[StreamEvent]:
            yield StreamEvent(type="message_started", data={"message_id": "msg"})
            yield StreamEvent(type="run_metrics", data={"crew_run_id": "run", "tokens": 10})

        session = SimpleNamespace(outcome=None)
        return session, iterator()

    monkeypatch.setattr(run_service, "stream", fake_stream)

    payload = {
        "messages": [{"role": "user", "content": "Ping"}],
        "org_id": "org-1",
        "conversation_id": "conv-1",
        "user_id": "user-1",
    }

    response = client.post(
        "/api/chat/stream", json=payload, headers={"Authorization": "Bearer dev"}
    )

    assert response.status_code == 200
    body = response.text
    assert "event: message_started" in body

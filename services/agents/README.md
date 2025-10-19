# Hubble Agents Service

An authentication-first CrewAI backend. The service exposes a single FastAPI
endpoint that coordinates three agents (manager, marketer, analyst) to produce a
structured response for authorised callers.

## Features

- Bearer-token authentication with optional Clerk JWT support.
- CrewAI orchestration defined via YAML-configured agents and tasks.
- Streaming Server-Sent Events endpoint that delivers agent deltas, tool activity, and lifecycle updates in real time.
- Supabase-backed persistence for conversations, messages, runs, task events, artifacts, and pgvector memories.
- OpenTelemetry instrumentation with SigNoz-compatible OTLP export covering FastAPI, CrewAI runs, and token usage metrics.
- Structured JSON responses containing summary, action list, and token usage for non-streaming callers.
- Lightweight CLI helper for local testing.

## Project Layout

```text
services/agents/
├── pyproject.toml
├── README.md
└── src/hubble_agents/
    ├── config/          # Settings plus agents.yaml / tasks.yaml
    ├── crew.py          # CrewAI @CrewBase implementation
    ├── main.py          # FastAPI application
    ├── middleware/      # Auth and rate-limiting utilities
    ├── models/          # Pydantic request/response models
    └── cli.py           # Optional CLI entrypoint
```

## Getting Started

```bash
# Install dependencies (run inside services/agents)
uv sync

# Start the API server on http://localhost:8000
uv run --env-file ./.env.local uvicorn hubble_agents.main:app --reload

# Optional: run the CLI
uv run python -m hubble_agents.cli --prompt "Plan a product launch"
```

### Required Environment Variables

```text
ANTHROPIC_API_KEY=sk-live-or-test
SERVICE_AUTH_SECRET=at-least-32-characters
SUPABASE_DB_URL=postgresql://user:pass@host:6543/postgres
SUPABASE_SERVICE_ROLE_KEY=service-role-secret
SUPABASE_STORAGE_BUCKET=agent-artifacts
ENVIRONMENT=development
LOG_LEVEL=INFO
DASHBOARD_URL=http://localhost:3000
CLERK_ENABLED=false
# Optional telemetry
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.us.signoz.cloud:443
SIGNOZ_INGESTION_KEY=... (only when OTEL endpoint is set)
OTEL_SERVICE_NAME=agents-backend
```

### Authentication

Provide a Bearer token via the `Authorization` header. The middleware first
attempts Clerk JWT validation (when enabled) and falls back to HMAC tokens for
local development. Use `services/agents/generate_token.py` to mint development
tokens.

## API

`POST /api/chat`

```json
{
  "messages": [{ "role": "user", "content": "Help us plan the beta launch." }],
  "org_id": "org-123",
  "conversation_id": "conv-456",
  "user_id": "user-789"
}
```

Response:

```json
{
  "summary": "High-level answer",
  "actions": ["First follow-up", "Second follow-up"],
  "raw": "Full text response...",
  "tokens": 1234
}
```

`POST /api/chat/stream`

Streams Server-Sent Events back to the caller. Events include `message_started`, `message_delta`, `message_completed`, `task_started|completed`, `tool_started|completed|error`, `run_started`, and `run_metrics`. Each event payload adheres to the JSON schema persisted in Supabase so UIs and observability dashboards can remain consistent.

Example usage with `curl`:

```bash
curl -N -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -X POST http://localhost:8000/api/chat/stream \
     -d '{
       "messages": [{"role": "user", "content": "Plan the beta launch."}],
       "org_id": "org-123",
       "conversation_id": "conv-456",
       "user_id": "user-789"
     }'
```

The server responds with SSE frames such as:

```sse
event: message_started
data: {"message_id":"...","seq":2}

event: message_delta
data: {"message_id":"...","delta":"Drafting launch timeline"}

event: run_metrics
data: {"crew_run_id":"...","tokens":1234}
```

## Testing

```bash
uv run --env-file ./.env.local pytest
```

The current test suite focuses on the FastAPI request/response contract and
authentication helpers.

## CLI

```bash
uv run python -m hubble_agents.cli --prompt "Summarise weekly metrics"
```

The CLI uses the same crew configuration and prints the structured response to
stdout, making it ideal for quick manual verification.

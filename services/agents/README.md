# Hubble Agents Service

A lightweight Pydantic AI backend that exposes a supervisor agent over FastAPI
with server-sent event (SSE) streaming. The supervisor delegates work to
specialised agents (analyst and marketer) using `pydantic-ai`'s native tool
pattern.

## Features

- Supervisor agent built on `pydantic-ai` with clear delegation hooks.
- True streaming responses by translating `StreamedRunResult` directly to SSE.
- Optional MotherDuck MCP integration for SQL execution.
- Supabase persistence capturing prompt, response, and usage metadata.
- Minimal CLI for quick manual runs without starting the server.

## Project Layout

```text
src/hubble_agents/
├── agents/          # Supervisor + specialised agents
├── config/          # Application settings and auth helpers
├── db/              # Supabase client + persistence helpers
├── main.py          # FastAPI application entrypoint
├── utils/           # Logging, streaming adapters, utilities
└── mcp_client/      # MotherDuck MCP client wrappers
```

## Local Development

```bash
# Install Python dependencies (run inside services/agents)
uv sync

# Start the API server on http://localhost:8001
uv run --env-file ./.env.local uvicorn hubble_agents.main:app --reload

# Optional: run the CLI for a one-off prompt
uv run python -m hubble_agents.cli --prompt "Plan a product launch"
```

### Environment Variables

The settings module honours both nested keys (e.g. `SUPABASE__URL`) and the
legacy flat aliases. Typical local configuration:

```text
ANTHROPIC_API_KEY=sk-local
SERVICE_AUTH_SECRET=changeme
ENVIRONMENT=development
LOG_LEVEL=DEBUG
DASHBOARD_URL=http://localhost:3000

SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_KEY=local-service-role
SUPABASE_TIMEOUT=10

MCP_MOTHERDUCK_URL=http://127.0.0.1:8001
MOTHERDUCK_TOKEN=
DATABASE_NAME=hubble_dev

CLERK_ENABLED=false
MAX_REQUESTS_PER_MINUTE=100
```

## API Endpoint

`POST /api/chat/stream` accepts a `ChatRequest` payload and returns a
server-sent event stream. Each event is JSON and includes a monotonic `seq` and
ISO timestamp:

- `response_start` — initial metadata
- `thinking_delta` — partial reasoning tokens (when available)
- `text_delta` — incremental text output
- `tool_call` / `tool_result` — sub-agent delegations
- `response_complete` — final output text and usage statistics

The last event also triggers a Supabase insert through
`hubble_agents.db.record_agent_run` with the prompt, response, and usage block.

## Testing

```bash
uv run --env-file ./.env.local pytest
```

Unit tests focus on the streaming adapter, persistence helper, and auth logic.

## CLI

The CLI wraps the supervisor agent for quick manual tests:

```bash
uv run python -m hubble_agents.cli --prompt "Summarise weekly metrics"
```

It loads settings from the same environment variables as the API and prints the
final supervisor output to stdout.

## Extending

- Add new specialised agents in `agents/` and register them as supervisor tools.
- Enhance persistence by expanding the payload in `db/runs.py`.
- Integrate additional transports by adjusting `utils/streaming.iterate_sse_events`.

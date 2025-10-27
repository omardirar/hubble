# H10S Agents API + Persistence Implementation Plan

Status: Draft (awaiting approval)
Owner: Agents Service
Last updated: 2025-10-27

Goals

- Add a FastAPI-based API layer that follows agent protocol concepts (assistants/threads/runs/messages, SSE streaming)
- Persist interactions to Supabase in a dedicated h10s schema (RLS-aware, multi-tenant via Clerk org_id)
- Integrate Clerk auth for API requests
- Resolve and inject MotherDuck credentials per-org at runtime for MCP tools
- Refactor graphs to reduce complexity and improve maintainability

1. Current state (evidence-based)

- Graphs exist (LangGraph), no API app present; Dockerfile expects h10s.main:app

```python path=/Users/omar/Documents/hubble/services/agents/src/h10s/graphs/copilot.py start=88
    headers_override = configurable.get("motherduck_headers") or configurable.get(
        "mcp_motherduck_headers"
    )
    ...
    mcp_tools = _load_mcp_tools(settings, headers_override=headers_override)
```

```python path=/Users/omar/Documents/hubble/services/agents/src/h10s/graphs/mcp_tools.py start=33
    headers: dict[str, str] = {
        key: value for key, value in (headers_override or {}).items() if value
    }
    if not headers:
        if settings.motherduck_token:
            headers["x-motherduck-service-secret"] = settings.motherduck_token.get_secret_value()
        if settings.motherduck_connection:
            headers["x-motherduck-connection"] = settings.motherduck_connection
```

```json path=/Users/omar/Documents/hubble/langgraph.json start=1
{
  "dependencies": ["."],
  "graphs": {
    "copilot": "./services/agents/src/h10s/graphs/copilot.py:agent"
  },
  "env": "./services/agents/.env.local"
}
```

- No FastAPI app files detected under services/agents/src/h10s (no app.py/main.py)
- MotherDuck provisioning persists org-scoped token to secrets and destination metadata

```ts path=/Users/omar/Documents/hubble/packages/connect/src/jobs/provision-job.ts start=240
  // Store the token in secrets table (idempotent operation)
  if (!tokenFromSecrets) {
    await db.rpc("set_secret", { p_org_id: orgId, p_secret_name: "md_sa_token", p_secret_value: token })
  }
  ...
  await db.from("data_destinations").upsert({
    org_id: orgId,
    md_db_name: mdDbName,
    md_token_ref: `md_sa_token:${orgId}`,
    fivetran_destination_id: destination_id,
    status: "healthy",
  }, { onConflict: "org_id" })
```

- Relevant DB structures exist (no h10s schema yet)

```sql path=/Users/omar/Documents/hubble/supabase/migrations/20251011101126_remote_schema.sql start=1217
CREATE TABLE IF NOT EXISTS "connect"."data_destinations" (
  id uuid default gen_random_uuid() primary key,
  org_id text not null,
  md_db_name text not null,
  md_token_ref text not null,
  fivetran_destination_id text,
  status connect.destination_status_t default 'pending' not null
);
```

```sql path=/Users/omar/Documents/hubble/supabase/migrations/20251011101126_remote_schema.sql start=1943
CREATE TABLE IF NOT EXISTS system.secrets (
  id uuid default gen_random_uuid() primary key,
  org_id text not null,
  secret_name text not null,
  secret_value text not null
);
-- public.get_secret(), public.set_secret() delegate to system.*
```

- services/agents/.env.example includes Supabase + JWT settings, suggesting an API was planned but not implemented

2. Proposed architecture (pragmatic, minimal, library-first)

- App structure under services/agents/src/h10s
  - api/
    - main.py (FastAPI app factory + lifespan)
    - deps.py (auth, db, settings dependencies)
    - routers/
      - health.py
      - threads.py (create/get/list messages)
      - runs.py (start run + SSE stream)
  - auth/
    - clerk.py (JWT verification via JWKS, extract sub, org_id)
  - db/
    - pool.py (asyncpg pool)
    - repositories/
      - interactions.py (h10s.threads/messages/runs CRUD)
      - motherduck.py (resolve headers via get_secret + data_destinations)
  - graphs/
    - nodes/
      - performance_analyst.py
      - seo.py
      - planner.py
      - media_buyer.py
      - utils.py (table parsing/cache)
    - copilot.py (updated imports)
    - mcp_tools.py (unchanged API; moved to tools/ if preferred)
  - schema/
    - api.py (Pydantic request/response models for API)
    - domain.py (internal types)
  - config/
    - settings.py (extend for API env: SUPABASE_DB_URL, CLERK_ISSUER, etc.)

- Data flow
  1. Client calls API with Clerk bearer JWT (contains org_id)
  2. Auth dependency verifies JWT via JWKS and yields { user_id, org_id }
  3. For run start, load thread + messages from h10s, resolve MotherDuck headers:
     - select md_db_name from connect.data_destinations where org_id = $1
     - token = rpc get_secret(org_id, 'md_sa_token')
     - headers = { 'x-motherduck-service-secret': token, 'x-motherduck-connection': `md:${md_db_name}` }
  4. Invoke LangGraph compiled graph with config.configurable.motherduck_headers=headers
  5. Stream events over SSE; persist assistant/tool messages to h10s.messages

- Agent Protocol surface (minimal subset)
  - POST /api/v1/threads -> { id }
  - GET /api/v1/threads/{id}
  - GET /api/v1/threads/{id}/messages
  - POST /api/v1/threads/{id}/messages -> add user message
  - POST /api/v1/runs -> start run { thread_id, input } -> { run_id }
  - GET /api/v1/runs/{id}/events -> SSE of graph events
    Notes: Mirrors assistants/threads/runs/messages concepts; avoids re-implementing full LangGraph Server; can evolve toward full spec later. We will use FastAPI and Starlette streaming.

- Authentication
  - Verify Clerk JWT via JWKS (PyJWT/cryptography) against CLERK_ISSUER
  - Extract claims: sub (user_id), org_id (string) — reject if missing
  - Attach auth context to request state/dependency

- Persistence (new h10s schema)
  - h10s.threads: id uuid pk, org_id text, owner_user_id text, title text, created_at/updated_at
  - h10s.messages: id uuid pk, thread_id uuid fk, org_id text, author_user_id text, role text check in ('user','assistant','tool','system'), content jsonb, created_at
  - h10s.runs: id uuid pk, thread_id uuid fk, org_id text, status text, started_at, finished_at, error text
  - h10s.message_sequences or function for sequencing (optional; prefer created_at + id ordering)
  - RLS: org_id = jwt_claim('org_id'); owner-only policies for threads/messages; service_role full access
  - Indices: by org_id, thread_id/created_at; unique constraints as needed

- MotherDuck credential resolution
  - Query connect.data_destinations (md_db_name)
  - token = public.get_secret(org_id,'md_sa_token')
  - Build headers mapping for mcp_tools.create_motherduck_tools
  - Fallbacks: if missing, run without tools (graph continues)

- Graph refactor
  - Split nodes.py into nodes/\<specialist\>.py + nodes/utils.py (table parsing, cache management)
  - Keep function signatures stable to minimize change surface in copilot.py

- Libraries to add (pyproject)
  - fastapi, uvicorn[standard], starlette, pydantic-settings (already), asyncpg, PyJWT[crypto] or python-jose, httpx, sse-starlette (optional; Starlette StreamingResponse also works)
  - langgraph-api optional later if we choose to mount built-in server; initial pass sticks to custom minimal API

3. Migrations (Supabase)

- New migration: supabase/migrations/2025xxxxxx_h10s_schema.sql
  - CREATE SCHEMA h10s;
  - CREATE TABLE h10s.threads (... as above ...);
  - CREATE TABLE h10s.messages (... as above ...);
  - CREATE TABLE h10s.runs (... as above ...);
  - Triggers set_updated_at, generated text_content (like public.messages)
  - RLS policies using jwt_claim('org_id')
  - Grants: authenticated select/insert on own rows; service_role full
  - Views (optional): public.h10s_threads/messages for client access

4. API surface (request/response contracts)

- POST /api/v1/threads
  - Body: { title?: string }
  - Response: { id, title, created_at }
- GET /api/v1/threads/{id}
  - Response: { id, title, created_at, updated_at }
- GET /api/v1/threads/{id}/messages
  - Query: ?limit=50&before=\<id\>
  - Response: [{ id, role, content (json), created_at }]
- POST /api/v1/threads/{id}/messages
  - Body: { role: 'user', content: { text: string } }
  - Response: { id }
- POST /api/v1/runs
  - Body: { thread_id: uuid, input?: string }
  - Response: { run_id }
- GET /api/v1/runs/{id}/events (SSE)
  - Events: run.started, block.delta, tool.started/finished, run.completed/failed

5. Operational concerns

- Lifespan: initialize asyncpg pool; close on shutdown
- CORS: allow dashboard origin(s)
- Limits: request body size, prompt length
- Logging: structured logs; correlate with run_id/thread_id
- Observability: optional OTEL hooks (env present in .env.example)

6. Implementation steps

- Add dependencies to services/agents/pyproject.toml
- Create FastAPI app (api/main.py) + app factory (return FastAPI)
- Auth (auth/clerk.py): JWKS retrieval + cache; dependency returns {user_id, org_id}
- DB (db/pool.py): asyncpg Pool; repositories for interactions + motherduck
- Routers: health, threads, runs (SSE via StreamingResponse)
- Graph integration: import compiled = agent({}); on run, call compiled.astream_events(..., config={configurable: {motherduck_headers}})
- Refactor graphs/nodes into modules (no behavior change)
- Create Supabase migration for h10s schema (idempotent; RLS)
- Wire Dockerfile CMD to new app module if different (currently h10s.main:app)

7. Open questions / decisions

- Agent Protocol surface depth: minimal subset now vs full LangGraph Server parity?
- Should we additionally mount LangGraph Server endpoints for Studio compatibility? (can be a phase 2 using langgraph-api with custom FastAPI app)
- Any non-default Clerk claims to enforce (audience/issuer)? Provide env variables if so

Appendix: Risks and mitigations

- Risk: JWT verification drift — use JWKS and cache with kid support
- Risk: DB RLS bypass — service writes only; read APIs enforce org filters; consider adding restrictive RLS on h10s tables
- Risk: Tool auth failures — degrade gracefully (run without tools), include clear error in SSE
- Risk: Over-complexity — keep nodes small; repositories thin; no custom checkpointer in v1

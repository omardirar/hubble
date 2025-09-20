## Hubble

An AI‑powered Marketing Assistant with a full‑stack Next.js 15 app, Clerk authentication, Supabase for data, and shared TypeScript packages. It includes a Chat experience and a Connect feature that provisions a per‑tenant MotherDuck database and a Fivetran destination, orchestrated via Upstash QStash and Redis.

### Tech stack

- **Frontend**: Next.js 15 App Router, React 19, Tailwind (via `@hubble/ui`)
- **Auth**: Clerk (`@clerk/nextjs`)
- **Database**: Supabase (Postgres, RLS, Secure Secrets Table)
- **Background orchestration**: Upstash QStash (HTTP queue), Upstash Redis (lock + pub/sub)
- **Data platform**: MotherDuck (DB), Fivetran (destination)
- **CI/CD**: GitHub Actions, Vercel (Node runtime for API routes)
- **Monorepo**: Turborepo + PNPM workspaces

### Monorepo layout

- `apps/dashboard` — Next.js 15 app (UI + API routes)
- `packages/ui` — shared UI components & styles (Tailwind preset)
- `packages/utils` — shared utilities (logger, fetch, chat helper, API handlers, connect helpers)
- `packages/db` — Supabase client factories (`createBrowserClient`, `createServiceClient`)
- `packages/env` — validated environment accessors (`getServerEnv`, `getConnectEnv`)
- `packages/api-contracts` — Zod schemas and validation for API contracts
- `packages/auth` — auth/org utilities bridging Clerk/Supabase
- `infra/supabase` — reference SQL schema (connect + clerk + chat, functions, RLS, secure secrets helpers)
- `docs` — ancillary docs
- `.github/workflows` — CI pipelines

### Requirements

- Node 20.x, PNPM 9.x (enforced via `package.json` engines)
- Supabase project (with secure secrets table)
- Clerk application (publishable/secret keys)
- Upstash QStash + Upstash Redis accounts
- MotherDuck + Fivetran credentials (for Connect)

### Getting started

1. Install deps: `pnpm install`
2. Create `./.env.local` at repo root and populate variables (see below)
3. Run all apps in dev: `pnpm dev` (or `pnpm --filter @hubble/dashboard dev`)
4. Open `http://localhost:3000`, complete Clerk sign‑in
5. Lint/typecheck before pushing: `pnpm lint`, `pnpm typecheck`

### Scripts (root)

- `pnpm dev` — start dev targets via Turbo
- `pnpm build` — build all packages/apps
- `pnpm typecheck` — TypeScript across workspaces
- `pnpm lint` — ESLint across workspaces
- `pnpm test` — repo tests (where present)

### Environment variables (root .env.local)

- Supabase
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Clerk
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
- Upstash QStash
  - `QSTASH_URL` (default: `https://qstash.upstash.io`)
  - `QSTASH_TOKEN`
  - `QSTASH_CURRENT_SIGNING_KEY`
  - `QSTASH_NEXT_SIGNING_KEY`
- Upstash Redis (REST; required)
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Upstash Redis (WebSocket; required for SSE)
  - `UPSTASH_REDIS_WS_URL`
  - `UPSTASH_REDIS_WS_TOKEN`
- MotherDuck
  - `MD_ADMIN_TOKEN`
- Fivetran
  - `FIVETRAN_API_KEY`
  - `FIVETRAN_API_SECRET`

### API quick reference

- Health & version
  - `GET /healthz` → "ok"
  - `GET /version` → `{ version, buildTime, environment, gitCommit, gitBranch }`

- Chat
  - `POST /api/v1/chat` → AI reply `{ reply }`
  - `GET /api/v1/chat/conversations` → list summaries
  - `POST /api/v1/chat/conversations` → create conversation
  - `PATCH /api/v1/chat/conversations/:id` → update title/archive
  - `GET /api/v1/chat/messages/:conversationId` → list messages
  - `POST /api/v1/chat/messages/:conversationId` → append message (idempotent)

- Connect (MotherDuck + Fivetran)
  - `POST /api/connect/enable` → enqueue provisioning `{ correlation_id, status: "pending" }`
  - `GET /api/connect/status?correlation_id=…` → `{ status, md_db_name?, fivetran_destination_id?, timeline: [...] }`
  - `GET /api/connect/stream?correlation_id=…` → SSE stream (`event: update`, JSON data)

### Connect feature

#### Overview

- Multi-step tenant provisioning that issues a dedicated MotherDuck database and Fivetran destination per organization.
- Orchestrated via Upstash QStash (ingress queue) and Upstash Redis (distributed lock + pub/sub fan-out for status streaming).
- DB state lives in Supabase (`tenants`, `provisioning_runs`, `events`, `tenant_destinations`) with strict RLS; service-role flows happen only inside the queue consumer.
- Shared logic is packaged in `@hubble/queue` (QStash helpers), `@hubble/redis` (lock/event primitives), and `@hubble/env` (runtime validation) to keep app routes thin.

#### API surface

- `POST /api/connect/enable` — Requires authenticated org context; creates a `provisioning_runs` row inside a transaction and either enqueues a QStash job (staging/prod) or executes inline when bypassed (dev). Responds with `{ correlation_id, status: "pending" }`.
- `GET /api/connect/status?correlation_id=<id>&since_seq=<optional>` — Returns run metadata plus only timeline entries whose `event_seq` is greater than `since_seq`. Useful for polling UIs.
- `GET /api/connect/stream?correlation_id=<id>` — Server-Sent Events stream that emits `event: update` per new timeline item and `event: end` with `{ status: "ready" | "failed" }` when the run terminates.
- `POST /api/queues/provision` — QStash consumer (Node runtime) that validates signature in production, acquires Redis lock, executes the provisioning workflow, and surfaces typed errors (`lock-not-acquired`, `lock-unavailable`, `failed`).

#### Provisioning workflow (idempotent)

1. Acquire `provision:org:<org_id>` lock via `@hubble/redis` (random token + Lua release) — TTL refreshed as steps complete.
2. Transition Supabase run status to `running` and write timeline events with monotonic `event_seq`.
3. MotherDuck:

- Create service account (`mdCreateServiceAccount`), tolerating HTTP 409 conflicts.
- Issue service-account token and persist in secure secrets table via `set_service_secret(org_id, 'md_sa_token', token)`.
- Create per-tenant database (`md_<org_id>`), tolerating 409 conflicts.

4. Fivetran:

- Upsert MotherDuck destination using deterministic external IDs.
- Poll destination test endpoint with exponential backoff (six attempts) and fail fast if still unhealthy.

5. Persist destination metadata into `tenant_destinations` and mark run `ready` (or `failed` with `finished_at`).
6. Publish each timeline event to Redis channel `provision:events:<correlation_id>` so SSE clients can render live updates.

#### Environment & secrets

- Required env vars are validated by `getConnectEnv()` and split across:
  - **Queue**: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` (supports key rotation).
  - **Redis**: REST (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) and optional WebSocket credentials (`UPSTASH_REDIS_WS_URL`, `UPSTASH_REDIS_WS_TOKEN`) for SSE.
  - **MotherDuck**: `MD_ADMIN_TOKEN` (admin scope; never returned to clients).
  - **Fivetran**: `FIVETRAN_API_KEY`, `FIVETRAN_API_SECRET`.
- `@hubble/env` caches validated configs; use `clearEnvCache()` in tests to reset between suites.

#### Redis & locking

- `acquireLock(key, ttlMs)` returns a handle `{ key, token, ttlMs, acquiredAt }`; Lua scripts guarantee only the creator can release or extend.
- `processProvisionJob` wraps release in a `finally` block; failures emit `LockServiceUnavailableError` to surface Redis outages distinctly from contention (`LockNotAcquiredError`).
- TTL defaults to 5 minutes per run; extend or shorten by adjusting `LOCK_TTL_MS` as provisioning steps evolve.

#### QStash behaviour

- **Local Development**: Use `pnpm dev:qstash` to start the QStash development server locally. This provides full QStash functionality including schedules, URL groups, workflows, and event logs.
- **Production**: Uses the hosted QStash service at `https://qstash.upstash.io`.
- `dispatchQStashJson` automatically detects the environment and uses the appropriate QStash endpoint.
- `withQStashVerification` wraps handlers with signature verification unless `NODE_ENV !== production`; rotate signing keys by populating both `current` and `next` envs.
- All publish requests include `Upstash-Deduplication-Id = correlation_id` for ingress idempotency.

#### Local Development Setup

1. Start QStash development server: `pnpm dev:qstash`
2. Copy the provided credentials to your `.env.local` file
3. Start your application: `pnpm dev`

#### Database artifacts

- `supabase/migrations/02_connect_schema.sql` provision:
  - `provisioning_runs` table (enum status, timestamps, unique `correlation_id`).
  - `events` table with append-only trigger assigning monotonically increasing `event_seq` per correlation.
  - RLS policies restricting access to the caller’s org via `public.current_org_id()`.
  - Triggers to maintain `updated_at` timestamps and block mutation of historical events.
- Partial index `idx_runs_org_active` (pending/running) plus lock logic prevent duplicate concurrent runs per org.

#### Observability & troubleshooting

- Structured logs (pino-style JSON in production) include request IDs, org IDs, and step names (`connect.enable.*`, `connect.stream.*`).
- Status API supports incremental fetch via `since_seq`; polls can request only new events to reduce payload size.
- For long-running issues, inspect Supabase tables: `select * from provisioning_runs order by started_at desc` and join with `events`.
- Redis channels prefixed with `provision:events:` let you attach external subscribers for dashboards or alerting.
  TODO: Write provisioning runbook
  Context: Document operator steps for stuck Connect runs, manual retries, QStash key rotation, and Redis health checks in docs/runbooks/provisioning.md
  labels: area/docs, feature/connect, type/process
  assignees: omzification
  milestone: 0.0.1

#### Local testing

- Ensure `.env.local` contains Connect credentials; `pnpm dev` spins up dashboard + worker routes.
- Trigger Connect via `POST /api/connect/enable` after signing in through Clerk.
- Watch live updates:
  - Poll: `curl "http://localhost:3000/api/connect/status?correlation_id=<id>&since_seq=0"`.
  - Stream: `curl -N "http://localhost:3000/api/connect/stream?correlation_id=<id>"`.
- To simulate contention, fire two enable requests rapidly; the second should receive HTTP 409 (`lock-not-acquired`).
- To test Redis outage handling, temporarily revoke the Upstash REST token—`/api/queues/provision` will surface HTTP 503 (`lock-unavailable`).

### Chat feature

- Uses `@hubble/ui` blocks/components and server routes under `/api/v1/chat/*`.
- All DB access honors RLS via Clerk JWT → Supabase (browser client with Authorization).
- Messages are stored with normalized JSON content and derived `text_content` for search/snippets.
- Idempotency for message insertion is enforced with `(conversation_id, idempotency_key)` unique index.

### Database (Supabase)

- **Schemas**: public (connect + chat), clerk (mirror tables for users/orgs), extensions.
- **RLS**: enabled for conversations/messages and connect tables. Policies scope to `auth.jwt()->>'sub'` and `public.current_org_id()`.
- **Views**: `v_tenants`, `v_tenant_destinations`, `v_connections`, `conversation_summaries`.
- **Helpers**:
  - `public.current_org_id()`; `public.jwt_claim(text)`
  - `public.get_service_secret(org_id, secret_name)` and `public.get_md_sa_token(org_id)` (read)
  - `public.set_service_secret(org_id, secret_name, secret_value)` (write) — SECURITY DEFINER; EXECUTE granted to service_role
- These migrations are reference‑only; production runs on Supabase Cloud managed outside this repo.

### Auth & security

- Clerk middleware protects non‑public routes; API handlers use `createApiHandler` to require auth/org.
- Never use `createServiceClient()` for user‑scoped routes; only for server/consumer tasks where RLS bypass is intended.
- QStash consumer verifies signature (simplified stub; replace with official verification for production).

### CI & deployment

- **CI**: `.github/workflows/ci.yml` runs lint, typecheck, build, test on pushes/PRs.
- **Deployment**: Vercel with Node runtime functions. SSE route uses extended duration/memory (Fluid Compute‑like settings in `apps/dashboard/vercel.json`).
- Ensure all secrets are set in Vercel project settings.

### Testing

- Local dev: sign in via Clerk at `{{base_url}}`, then test APIs via Postman (cookies synced) or curl.
- Quick Connect test:
  1. `POST /api/connect/enable` → get `correlation_id`
  2. `GET /api/connect/status?correlation_id=…` → observe timeline progress → `ready`
  3. `GET /api/connect/stream?correlation_id=…` (via curl/Insomnia) → live updates
- Chat test:
  - Create conversation, send messages, verify message list and optimistic updates in the UI.

### Postman

- Import the provided collection JSON (Connect + Chat + Health). Ensure Postman Interceptor is enabled and Clerk cookies are captured for `{{base_url}}`.

### Troubleshooting

- `401 Unauthorized`: cookies not attached → re‑login in browser, re‑sync cookies into Postman.
- SSE not streaming: set `UPSTASH_REDIS_WS_URL/TOKEN`. Postman may not display SSE; use curl/Insomnia.
- Provisioning stuck/failed: check `/api/connect/status` timeline and verify MotherDuck/Fivetran/Upstash envs.

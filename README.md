## Hubble

An AI‑powered Marketing Assistant with a full‑stack Next.js 15 app, Clerk authentication, Supabase for data, and shared TypeScript packages. It includes a Chat experience and a Connect feature that provisions a per‑tenant MotherDuck database and a Fivetran destination, orchestrated via Upstash QStash and Redis.

### Tech stack

- **Frontend**: Next.js 15 App Router, React 19, Tailwind (via `@hubble/ui`)
- **Auth**: Clerk (`@clerk/nextjs`)
- **Database**: Supabase (Postgres, RLS, Vault)
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
- `infra/supabase` — reference SQL schema (connect + clerk + chat, functions, RLS, Vault helpers)
- `docs` — ancillary docs
- `.github/workflows` — CI pipelines

### Requirements

- Node 20.x, PNPM 9.x (enforced via `package.json` engines)
- Supabase project (Vault enabled for production)
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

- **Flow**: `enable` enqueues a QStash job targeting `/api/queues/provision`. The consumer acquires an org‑scoped Redis lock, executes idempotent steps (create MD service account, issue token, create DB, upsert Fivetran destination, test), logs events in Supabase, publishes progress to Redis pub/sub, and marks the run `ready`.
- **Security**:
  - MotherDuck service‑account token is stored in Supabase Vault under key `md_sa_token:<org_id>` using a SECURITY DEFINER function `public.vault_set`.
  - No plaintext tokens are returned via APIs.
  - Consumer uses the Supabase service role; user‑facing routes use RLS‑safe browser client.
- **SSE**: `/api/connect/stream` relays pub/sub updates. Requires WebSocket Redis envs; Postman doesn’t render SSE—use curl/Insomnia.
- **Provisioning steps** (idempotent):
  1. CREATE_SERVICE_ACCOUNT → 409 treated as success
  2. ISSUE_SA_TOKEN → overwrite Vault secret
  3. CREATE_TENANT_DATABASE → 409 treated as success
  4. CONFIGURE_COMPUTE (optional/no‑op)
  5. CREATE_FIVETRAN_DESTINATION → upsert by deterministic external id
  6. TEST_DESTINATION → exponential backoff
  7. READY → upsert `tenant_destinations`, mark run `ready`

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
  - `public.vault_get_secret(name)` and `public.vault_md_sa_token(org_id)` (read)
  - `public.vault_set(name, secret)` (write) — SECURITY DEFINER; EXECUTE granted to service_role
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

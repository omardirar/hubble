# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Core Development

```bash
# Install dependencies
pnpm install

# Start all development servers (uses Turbo)
pnpm dev

# Start only the dashboard app
pnpm --filter @hubble/dashboard dev

# Build all packages and apps
pnpm build

# Run TypeScript checks across all workspaces
pnpm typecheck

# Lint all code (ESLint)
pnpm lint

# Run tests
pnpm test

# Run tests for specific package
pnpm --filter @hubble/dashboard test
```

### Git & Commits

```bash
# Use structured commits with emoji (Commitizen)
pnpm commit

# Version bump and release (triggers changelog generation)
# Edit package.json version, then commit with "bump:" in message
```

### Testing & Quality

```bash
# Run pre-commit hooks
pre-commit run --all-files

# Test specific Connect API functionality
curl -X POST "http://localhost:3000/api/connect/enable"
curl "http://localhost:3000/api/connect/status?correlation_id=<id>"
curl -N "http://localhost:3000/api/connect/stream?correlation_id=<id>"

# Health checks
curl "http://localhost:3000/healthz"
curl "http://localhost:3000/version"
```

## Architecture Overview

### Monorepo Structure

Hubble is a **Turborepo + PNPM** monorepo with Next.js 15, organized into distinct layers:

**Apps Layer:**

- `apps/dashboard/` — Next.js 15 app with App Router, React 19, Tailwind CSS
- `servers/mcp/` — MCP (Model Context Protocol) server

**Packages Layer (Shared Libraries):**

- `packages/ui/` — Shared UI components & Tailwind preset
- `packages/utils/` — HTTP utilities, logging, chat helpers, server operations
- `packages/db/` — Supabase client factories (`createBrowserClient`, `createServiceClient`)
- `packages/env/` — Environment variable validation (`getServerEnv`)
- `packages/api-contracts/` — Zod schemas for API validation
- `packages/auth/` — Clerk/Supabase authentication bridge
- `packages/queue/` — QStash job orchestration utilities
- `packages/redis/` — Redis locking and pub/sub primitives

**Infrastructure Layer:**

- `supabase/migrations/` — Database schema (Connect, Chat, Clerk integration)
- `.github/workflows/` — CI/CD pipelines (lint, build, test, auto-release)

### Authentication & Security Architecture

**Multi-Provider Setup:**

- **Clerk** handles user authentication and organization management
- **Supabase RLS** enforces data access policies based on Clerk JWT tokens
- **Middleware** (`src/middleware.ts`) protects routes, public routes whitelist

**Security Flow:**

1. Clerk middleware validates JWT tokens
2. `createApiHandler` extracts auth context (userId, orgId)
3. Supabase clients respect RLS using Clerk JWT via Authorization header
4. Service role operations only in background queue consumers

### Connect Feature (Multi-Tenant Provisioning)

**Orchestration Pattern:**

- **Upstash QStash** for HTTP-based job queuing with signature verification
- **Upstash Redis** for distributed locking and pub/sub event streaming
- **Supabase** for persistent state with RLS (`provisioning_runs`, `events`)

**API Flow:**

1. `POST /api/connect/enable` → Creates run, enqueues QStash job
2. `POST /api/queues/provision` → Background consumer with Redis locking
3. `GET /api/connect/status` → Polling API with incremental updates
4. `GET /api/connect/stream` → Server-Sent Events for real-time status

**Provisioning Workflow (Idempotent):**

1. Acquire `provision:org:<org_id>` Redis lock with TTL refresh
2. Create MotherDuck service account and per-tenant database
3. Upsert Fivetran destination with health checks
4. Store credentials in Supabase Vault, publish events to Redis channels

### Database Architecture

**Supabase Setup:**

- **Public Schema:** Connect tables (`provisioning_runs`, `events`) and Chat tables
- **Clerk Schema:** Mirrored user/org data with foreign data wrapper
- **RLS Policies:** Scope access to `public.current_org_id()` from JWT
- **Vault Integration:** Secure credential storage for MotherDuck tokens

**Key Views:**

- `v_tenants` — Organization metadata with Connect status
- `v_connections` — Active provisioning runs with timeline
- `conversation_summaries` — Chat conversations with metadata

### Package Dependencies & Client Architecture

**Client-Side Pattern:**

```typescript
// Browser clients use anon key + JWT in Authorization header
const client = createBrowserClient({ authToken: clerkJWT })
```

**Server-Side Pattern:**

```typescript
// Service role for RLS bypass (queue consumers only)
const client = createServiceClient()
// Regular auth context for user-scoped operations
const handler = createApiHandler(async (req, auth) => { ... })
```

**Environment Validation:**

- `@hubble/env` centralizes runtime environment validation
- Split configs for different contexts (Connect, QStash, Redis)
- Cache validated configs with `clearEnvCache()` for testing

## Development Guidelines

### Code Style

- **TypeScript** with ES modules throughout
- **2-space indentation**, LF line endings (enforced by `.editorconfig`)
- **Prettier** formatting via `@hubble/prettier-config`
- **ESLint** rules via `@hubble/eslint-config`

### Testing Strategy

- **Vitest** + Testing Library in apps
- Colocate test files as `*.test.ts` or use `__tests__/` directories
- Focus on critical UI logic and API route behavior

### Environment Setup

- Copy `.env.example` to `.env.local` at repo root
- Required: Supabase (URL, anon key, service role), Clerk (publishable/secret keys)
- Connect feature: Upstash (QStash, Redis), MotherDuck, Fivetran credentials

### Inline TODOs

Use structured format for automatic issue creation:

```text
TODO: Short imperative title
Context: Brief explanation of why/intent
labels: area/x, feature/y, type/z
assignees: omzification
milestone: 0.x.x
```

## Common Debugging Scenarios

### Connect Feature Issues

```bash
# Check provisioning status
curl "localhost:3000/api/connect/status?correlation_id=<id>&since_seq=0"

# Stream live updates
curl -N "localhost:3000/api/connect/stream?correlation_id=<id>"

# Inspect database state
# Check Supabase: provisioning_runs, events tables
```

### Authentication Problems

- **401 Unauthorized:** Check Clerk cookies in browser dev tools
- **JWT Issues:** Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- **RLS Violations:** Ensure using `createBrowserClient` with auth token, not service client

### Redis/QStash Issues

- **Lock contention:** Check Redis TTL settings and concurrent provisioning attempts
- **QStash signature failures:** Verify `QSTASH_CURRENT_SIGNING_KEY` in production
- **SSE not streaming:** Ensure WebSocket Redis credentials (`UPSTASH_REDIS_WS_URL`)

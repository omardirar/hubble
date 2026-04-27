# Hubble

An AI-powered Marketing Assistant with a full-stack Next.js 15 app, Clerk authentication, Supabase database, and shared TypeScript packages. Features a Chat interface and Connect provisioning system for per-tenant MotherDuck databases and Fivetran destinations, orchestrated via Upstash QStash and Redis.

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Package Documentation](#-package-documentation)
- [Requirements](#-requirements)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Core Features](#-core-features)
- [API Reference](#-api-reference)
- [Development](#-development)
- [CI/CD & Deployment](#-cicd--deployment)
- [Troubleshooting](#-troubleshooting)

## 🛠 Tech Stack

### Frontend & Framework

- **Framework**: Next.js 15 App Router with Turbopack
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4 with custom preset
- **Components**: Radix UI primitives, shadcn/ui patterns
- **State**: TanStack Query (React Query)
- **Authentication**: Clerk with JWT-based org context

### Backend & Infrastructure

- **Database**: Supabase (PostgreSQL with RLS)
- **Queue**: Upstash QStash (HTTP-based background jobs)
- **Cache/Locks**: Upstash Redis (REST + WebSocket)
- **Data Platform**: MotherDuck (DuckDB), Fivetran
- **Runtime**: Vercel (Node.js 20.x)
- **AI**: Anthropic Claude

### Development Tools

- **Monorepo**: Turborepo + pnpm workspaces
- **Language**: TypeScript 5.x (strict mode)
- **Linting**: ESLint with shared configs
- **Formatting**: Prettier with Tailwind plugin
- **Commits**: Commitizen with gitmoji

## 📁 Project Structure

```text
hubble/
├── apps/
│   └── dashboard/              # Next.js 15 web application
│
├── packages/                   # Shared TypeScript packages
│   ├── auth/                  # Authentication & org utilities
│   ├── chat/                  # Chat logic & DB operations
│   ├── config/                # Environment config & validation
│   ├── connect/               # Connect provisioning system
│   ├── core/                  # Core utilities & errors
│   ├── db/                    # Supabase client factories
│   ├── infrastructure/        # QStash & Redis services
│   ├── logger/                # Structured logging
│   ├── schemas/               # Zod schemas & validation
│   ├── server/                # Server-only utilities
│   ├── types/                 # Shared TypeScript types
│   ├── ui/                    # React components & Tailwind
│   ├── utils/                 # General utilities
│   ├── eslint-config/         # Shared ESLint config
│   ├── prettier-config/       # Shared Prettier config
│   └── tsconfig/              # Shared TS config
│
├── supabase/                  # Database migrations
├── docs/                      # Documentation
└── .github/workflows/         # CI/CD pipelines
```

## 📦 Package Documentation

### Core Packages

#### `@hubble/auth`

##### Authentication & organization management

Exports:

- `getOrgId(userId)` - Get org ID from Clerk data
- `getUserAndOrgFromToken(token)` - Extract user/org from JWT
- `getCurrentOrgId()` - Get current user's org (server-side)
- `extractJWTClaims(token)` - Parse JWT claims
- `getClerkSchemaName()` - Environment-specific Clerk schema
- `getClerkTableName(table)` - Fully qualified table name

#### `@hubble/chat`

##### Chat feature logic & database operations

Exports:

- `getConversations(supabase, logger)` - Fetch conversations
- `createConversation(supabase, data, logger)` - Create conversation
- `getMessages(supabase, conversationId, logger)` - Fetch messages
- `createMessage(supabase, data, logger)` - Create message (idempotent)
- `verifyConversationAccess(...)` - Check access permissions
- `useChatState(conversationId)` - React hook for chat state

#### `@hubble/connect`

##### MotherDuck + Fivetran provisioning

Exports:

- `processProvisionJob(payload)` - Execute provisioning workflow
- `insertProvisionRun(...)` - Start provisioning
- `updateProvisionRun(...)` - Update run status
- `createProvisionStream(id)` - SSE stream factory
- MotherDuck & Fivetran client utilities

#### `@hubble/core`

##### Core utilities & error handling

Exports:

- `cn(...inputs)` - Tailwind class merger
- `generateId(prefix?)` - Generate unique IDs
- Error classes: `AppError`, `DatabaseError`, `ValidationError`, etc.
- `ApiErrorCodes` - Standardized error codes
- `safeFetch(url, options)` - Fetch with error handling

#### `@hubble/db`

##### Supabase client factories

Exports:

- `createBrowserClient({ authToken })` - Client-side client (respects RLS)
- `createServiceClient()` - Server-side service role (bypasses RLS)

**Security:** Always use `createBrowserClient` for user operations!

#### `@hubble/infrastructure`

##### QStash & Redis services

QStash:

- `publishJson(options)` - Publish to queue
- `withQStashVerification(handler)` - Signature verification

Redis:

- `acquireLock(key, ttlMs)` - Distributed lock
- `releaseLock(lock)` - Release lock
- `publishEvent(channel, payload)` - Pub/sub

#### `@hubble/logger`

##### Structured logging

Exports:

- `logger` - Global logger (Pino)
- `logger.child(context)` - Child logger
- `logger.info/warn/error(event, data)` - Log methods

#### `@hubble/schemas`

##### Zod schemas & validation

Chat schemas, Connect schemas, validation helpers

#### `@hubble/server`

##### Server-only utilities

Exports all server-side packages plus:

- `createApiHandler(handler, options)` - API wrapper
- `getAuthContext(options)` - Auth context
- `sendToAnthropic(request, logger)` - Anthropic client
- Database error handlers

#### `@hubble/types`

##### Shared TypeScript types

Re-exports schemas plus utility types:

- `Optional<T, K>`, `RequiredFields<T, K>`
- `BaseEntity`, `Tenant`, `Connection`
- `ApiResponse<T>`, `PaginatedResponse<T>`

#### `@hubble/ui`

##### React components & Tailwind preset

Components: Button, Input, Card, Dialog, Sheet, Table, etc.

Blocks: Chat UI, Clerk components, Connect wizards, AI elements

Hooks: `useIsMobile()`, `useChatList()`, `useConnect()`, `useSupabase()`

Tailwind preset: Import from `@hubble/ui/styles/tailwind.preset`

#### `@hubble/utils`

##### General utilities (client-safe)

Re-exports core, chat, types, logger for client-side use

#### `@hubble/config`

##### Environment configuration

Exports:

- `getSupabaseConfig()` - Supabase credentials
- `getClerkConfig()` - Clerk credentials
- `getQStashConfig()`, `getRedisConfig()` - Upstash credentials
- `getMotherDuckConfig()`, `getFivetranConfig()` - Data platform credentials
- `getAnthropicConfig()` - AI credentials

## 📋 Requirements

- **Node.js**: 20.10+ (< 25)
- **pnpm**: 9.x+
- **Supabase**: Project with secure secrets table
- **Clerk**: Application with publishable/secret keys
- **Upstash**: QStash + Redis accounts
- **MotherDuck + Fivetran**: Credentials (for Connect)

## 🚀 Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Setup

Create `.env.local` at the root:

```bash
cp .env.example .env.local
```

### 3. Start Development

```bash
pnpm dev
```

### 4. Open Application

Navigate to `http://localhost:3000`

## 🔐 Environment Variables

### Supabase

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Clerk

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Upstash QStash

```env
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=your-token
QSTASH_CURRENT_SIGNING_KEY=your-key
QSTASH_NEXT_SIGNING_KEY=your-next-key
```

### Upstash Redis

```env
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
UPSTASH_REDIS_WS_URL=wss://...upstash.io
UPSTASH_REDIS_WS_TOKEN=your-token
```

### MotherDuck & Fivetran

```env
MD_ADMIN_TOKEN=your-token
FIVETRAN_API_KEY=your-key
FIVETRAN_API_SECRET=your-secret
```

### Anthropic (Optional)

```env
ANTHROPIC_API_KEY=your-key
```

## ✨ Core Features

### 💬 Chat Feature

AI-powered conversational interface with:

- Multi-conversation support
- Full message history
- Idempotent messages (duplicate prevention)
- Real-time updates with optimistic UI
- Archive support
- RLS security (org-scoped)

**Database:**

- `public.conversations` - Conversation metadata
- `public.messages` - Message content

**API:**

- `GET /api/v1/chat/conversations` - List conversations
- `POST /api/v1/chat/conversations` - Create conversation
- `GET /api/v1/chat/messages/:id` - List messages
- `POST /api/v1/chat/messages/:id` - Create message
- `POST /api/v1/chat` - Send chat (AI reply)

### 🔌 Connect Feature

Multi-step tenant provisioning for MotherDuck + Fivetran:

**Workflow:**

1. Create MotherDuck service account
2. Issue & store service account token
3. Create per-tenant database (`md_<org_id>`)
4. Create Fivetran destination
5. Test destination health
6. Persist metadata

**API:**

- `POST /api/connect/enable` - Start provisioning
- `GET /api/connect/status?correlation_id=<id>` - Poll status
- `GET /api/connect/stream?correlation_id=<id>` - SSE stream

**Features:**

- Idempotent with distributed locking
- Real-time status via SSE
- Timeline events with monotonic sequencing
- Exponential backoff retry logic

## 📚 API Reference

### Health & Version

- `GET /healthz` → `"ok"`
- `GET /version` → Version info

### Chat API

- `GET /api/v1/chat/conversations` - List conversations
- `POST /api/v1/chat/conversations` - Create conversation
- `PATCH /api/v1/chat/conversations/:id` - Update conversation
- `GET /api/v1/chat/messages/:conversationId` - List messages
- `POST /api/v1/chat/messages/:conversationId` - Create message
- `POST /api/v1/chat` - AI chat reply

### Connect API

- `POST /api/connect/enable` - Start provisioning
- `GET /api/connect/status` - Poll status
- `GET /api/connect/stream` - SSE stream
- `GET /api/connect/overview` - Connection overview
- `GET /api/connect/connector-types` - Available connectors

## 💻 Development

### Root Scripts

```bash
pnpm dev          # Start all apps
pnpm build        # Build all packages
pnpm typecheck    # TypeScript check
pnpm lint         # ESLint check
pnpm test         # Run tests
pnpm commit       # Commitizen commit
```

### Package Scripts

```bash
# Run specific package
pnpm --filter @hubble/dashboard dev
pnpm --filter @hubble/ui build
pnpm --filter @hubble/auth typecheck
```

### Code Quality

**Linting:**

```bash
pnpm lint
pnpm --filter @hubble/ui lint --fix
```

**Type Checking:**

```bash
pnpm typecheck
pnpm --filter @hubble/auth typecheck
```

**Formatting:**

```bash
pnpm --filter @hubble/dashboard format
pnpm --filter @hubble/dashboard format:check
```

### Commit Convention

Use Commitizen with gitmoji:

```bash
pnpm commit
```

Examples:

- `✨ feat: add workspace switcher`
- `🐛 fix: resolve auth token expiry`
- `📝 docs: update API docs`
- `♻️ refactor: simplify error handling`

## 🧪 Testing

```bash
pnpm test                              # All tests
pnpm --filter @hubble/dashboard test   # Specific package
```

Framework: Vitest + Testing Library

## 🚀 CI/CD & Deployment

### GitHub Actions

Workflow: `.github/workflows/ci.yml`

Runs on push/PR:

1. Install dependencies
2. Lint (`pnpm lint`)
3. Type check (`pnpm typecheck`)
4. Build (`pnpm build`)
5. Test (`pnpm test`)

### Vercel

- **Production**: `main` branch
- **Preview**: Pull requests
- Config: `apps/dashboard/vercel.json`

Set environment variables in Vercel project settings.

## 🔧 Troubleshooting

### `401 Unauthorized`

- ✅ Check Clerk cookies are attached
- ✅ Re-login and sync cookies
- ✅ Verify `CLERK_SECRET_KEY`
- ✅ Check JWT has `org_id` claim

### SSE Not Streaming

- ✅ Set Redis WebSocket credentials
- ✅ Use curl/Insomnia (not Postman)
- ✅ Check Redis connection

### Provisioning Stuck

1. Check `/api/connect/status?correlation_id=<id>`
2. Review timeline events
3. Verify credentials (MotherDuck, Fivetran, Upstash)
4. Check Supabase logs
5. Review `core.provisioning_workflows` table

### Build Errors

- ✅ Run `pnpm typecheck`
- ✅ `pnpm install`
- ✅ Clear cache: `pnpm turbo clean`
- ✅ Rebuild: `pnpm build`

### Cannot Find Module

- ✅ Build package: `pnpm --filter @hubble/<pkg> build`
- ✅ Check `package.json` exports
- ✅ Restart TS server
- ✅ Clear `.next` cache

## 📝 Additional Documentation

- [Chat API Documentation](docs/api/chat.md)
- [Chat Schema Analysis](docs/api/chat-schema-analysis.md)
- [Clerk Schema Switching](docs/clerk-schema-switching.md)
- [Setup Guide](docs/setup-clerk-supabase-native.md)

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Run: `pnpm lint && pnpm typecheck`
4. Commit: `pnpm commit`
5. Create pull request

**PR Guidelines:**

- Clear description
- Link issues
- Screenshots for UI changes
- Ensure CI passes

## 📄 License

MIT

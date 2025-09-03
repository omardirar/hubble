# Hubble

Modern Next.js app providing chat interface backed by Anthropic models and MotherDuck via MCP.

## Quickstart

```bash
npm install
cp .env.example .env
npm run dev
```

## Scripts
- `npm run lint` – run ESLint
- `npm run format` – format with Prettier
- `npm run typecheck` – TypeScript checks
- `npm test` – run Vitest suite

## Environment
See [.env.example](.env.example) for required variables.

## Chat API → MCP auth & DB scoping

- Transport: HTTP stream
- Auth: Clerk (`@clerk/nextjs/server` `auth()`) in a Node.js runtime route
- Tenant: Database name equals Clerk `orgId` (client `db` is a hint only)
- JWT: Short-lived RS256 token with `sub`, `db`, `iss`, `aud`, `exp≈90s`
- MCP: Per-request client via HTTP stream with headers
  - `Authorization: Bearer <RS256 JWT>`
  - `X-Db-Name: <resolved db>`
- Model: Anthropic via AI SDK v5 (`streamText`) with tool calling

### Flow
1. Clerk `auth()` → get `userId`, `orgId`.
2. Resolve DB from `orgId` server-side; validate optional client hint.
3. Sign RS256 JWT embedding `db` and user `sub`.
4. Initialize MCP client (HTTP stream) with per-request headers.
5. Discover tools; call `streamText` with Anthropic; stream to the browser (`useChat`).

### Errors
- 401 Unauthorized (no session) → JSON
- 403 Forbidden (no org / mismatch / no mapping) → JSON
- 502 Bad Gateway (MCP/tool discovery/model) → streamed safe error message
- 500 Internal Error → generic safe message

### Rate limiting (recommended)
Add a per-user limiter (e.g., Upstash Redis) at the start of the route; return 429 when exceeded.

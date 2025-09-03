This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Chat API → MCP auth & DB scoping

- Transport: HTTP stream
- Auth: Clerk (`@clerk/nextjs/server` `auth()`) in a Node.js runtime route
- Tenant: Database name equals Clerk `orgId` (client `db` is a hint only)
- JWT: Short-lived RS256 token with `sub`, `db`, `iss`, `aud`, `exp≈90s`
- MCP: Per-request client via HTTP stream with headers
  - `Authorization: Bearer <RS256 JWT>`
  - `X-Db-Name: <resolved db>`
- Model: Anthropic via AI SDK v5 (`streamText`) with tool calling

### Environment variables

Required:

- `ANTHROPIC_API_KEY`
- `MCP_MOTHERDUCK_URL` (HTTP stream endpoint, e.g. `https://<fly-app>.fly.dev/motherduck`)
- `MCP_JWT_PRIVATE_KEY` (PEM, RS256)
- `MCP_JWT_ISSUER`
- `MCP_JWT_AUDIENCE`

Optional:

- `ANTHROPIC_MODEL` (default model)
- `LOG_LEVEL`
// TODO: Provide a .env.example with placeholder variables matching env.d.ts
//  labels: docs, area:config, P2
//  assignees: me
//  milestone: M0 - Safety Net
//  evidence: README.md:49-63 — variables documented but no .env.example present

### Flow

1. Clerk `auth()` → get `userId`, `orgId`.
2. Resolve DB from `orgId` server-side; validate optional client hint.
3. Sign RS256 JWT embedding `db` and user `sub`.
4. Initialize MCP client (HTTP stream) with per-request headers.
5. Discover tools; call `streamText` with Anthropic; stream to the browser (`useChat`).
// TODO: Add sequence diagram for Chat flow (Clerk → DB resolve → JWT → MCP → AI)
//  labels: docs, area:api, P3
//  assignees: me
//  milestone: M2 - Refactors
//  evidence: README.md:64-71 — textual flow only, no diagram

### Errors

- 401 Unauthorized (no session) → JSON
- 403 Forbidden (no org / mismatch / no mapping) → JSON
- 502 Bad Gateway (MCP/tool discovery/model) → streamed safe error message
- 500 Internal Error → generic safe message
// TODO: Define consistent error response shape and map in UI error states
//  labels: area:api, area:ui, P2
//  assignees: me
//  milestone: M1 - Baseline Tests
//  evidence: README.md:72-78 — error states listed but no schema contract

### Rate limiting (recommended)

Add a per-user limiter (e.g., Upstash Redis) at the start of the route; return 429 when exceeded.
// TODO: Implement per-user limiter in API and document env/setup
//  labels: area:api, security, P1
//  assignees: me
//  milestone: M0 - Safety Net
//  evidence: README.md:79-82 — recommendation only, not implemented

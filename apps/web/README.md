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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load Google fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

Refer to the Next.js deployment documentation for various platforms.

## Git Hooks & Commitizen

- Install hooks: `pre-commit install -t pre-commit -t commit-msg -t pre-push`
- Author commits: `pnpm commit` (Commitizen with gitmoji prompts)
- Validation: commit messages are linted via Commitizen on `commit-msg`
- Lint/format: Prettier, ESLint, and basic safety checks run on `pre-commit`
- Type-check: TypeScript runs once per commit (no emit)

Notes:

- JS Commitizen (`cz-emoji`) is used for prompting. Root `.cz.json` config is used in CI for changelog/version tagging.
- Config files: `.pre-commit-config.yaml` and `.cz.json` (version/tag settings).

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
  <!-- TODO: Provide a .env.example matching env.d.ts -->
  <!--   Context: Add a developer-friendly .env.example aligned to required variables to reduce setup errors. -->
  <!--   labels: area/docs, feature/config, type/docs -->
  <!--   assignees: omzification -->
  <!--   milestone: 0.0.1 -->

### Flow

1. Clerk `auth()` → get `userId`, `orgId`.
2. Resolve DB from `orgId` server-side; validate optional client hint.
3. Sign RS256 JWT embedding `db` and user `sub`.
4. Initialize MCP client (HTTP stream) with per-request headers.
5. Discover tools; call `streamText` with Anthropic; stream to the browser (`useChat`).
   <!-- TODO: Add chat sequence diagram (Clerk → DB → JWT → MCP → AI) -->
   <!--   Context: Visualize request flow and error handling for onboarding and troubleshooting. -->
   <!--   labels: area/docs, feature/diagrams, type/docs -->
   <!--   assignees: omzification -->
   <!--   milestone: 0.0.1 -->

### Errors

- 401 Unauthorized (no session) → JSON
- 403 Forbidden (no org / mismatch / no mapping) → JSON
- 502 Bad Gateway (MCP/tool discovery/model) → streamed safe error message
- 500 Internal Error → generic safe message
  <!-- TODO: Define consistent error response shape and UI mapping -->
  <!--   Context: Specify error JSON schema and ensure UI maps codes/messages to user-friendly states. -->
  <!--   labels: area/web, feature/errors, type/quality -->
  <!--   assignees: omzification -->
  <!--   milestone: 0.0.1 -->

### Rate limiting (recommended)

Add a per-user limiter (e.g., Upstash Redis) at the start of the route; return 429 when exceeded.

<!-- TODO: Implement per-user rate limiter at API ingress -->
<!--   Context: Add 429 protection to chat/connect routes; document env and operational setup. -->
<!--   labels: area/api, feature/rate-limit, type/feature -->
<!--   assignees: omzification -->
<!--   milestone: 0.0.1 -->

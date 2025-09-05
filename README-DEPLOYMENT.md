## Cloudflare Workers + Git Builds Deployment

This app deploys to Cloudflare Workers using OpenNext’s Cloudflare adapter and Cloudflare Git integration (Builds). See Cloudflare Workers configuration docs for reference: [Workers Configuration](https://developers.cloudflare.com/workers/configuration/).

### What changes

- Deployments are handled by Cloudflare Builds (no GitHub Actions needed).
- Branch-to-environment mapping is configured in Cloudflare Dashboard.
- `wrangler.toml` remains the source of truth for Worker configuration and bindings.

### Prerequisites

- Node.js 20+
- Cloudflare account and a Workers project
- Repo connected to Cloudflare via Git Integration (Dashboard → Workers & Pages → Builds → Connect to Git)

### Project configuration

1. OpenNext Cloudflare build output
   - Build command: `npm ci && npm run build`
   - Output files: OpenNext generates `.open-next/worker.js` and assets in `.open-next/assets`

2. Worker entry and assets
   - `wrangler.toml` sets `main = ".open-next/worker.js"`
   - Assets binding configured under `[assets]` with `directory = ".open-next/assets"`

3. Compatibility
   - `compatibility_date` and `compatibility_flags = ["nodejs_compat"]` are set in `wrangler.toml` to match the Workers runtime

### Cloudflare Builds (Git integration)

In Cloudflare Dashboard:

1. Create a new Workers Build
   - Connect GitHub repository
   - Select the `cloudflare-deployment` or `main` branch as needed

2. Build settings
   - Build command: `npm ci && npm run build`
   - Output directory: Use the repository root. The Worker will use `.open-next/worker.js` as defined in `wrangler.toml`.

3. Environment mappings (recommended)
   - Preview env: PR branches and non-main branches
   - Production env: `main` branch
   - In Builds → Environments, set:
     - Preview → `workers_dev = true` (default). Deploys to `*.workers.dev`.
     - Production → Either keep `workers_dev = true` initially, or set `routes = ["your-domain.com/*"]` after DNS setup.

4. Secrets and environment variables
   - Define runtime secrets in Cloudflare Dashboard under each environment:
     - `ANTHROPIC_API_KEY`
     - `MCP_MOTHERDUCK_URL`
     - `MCP_JWT_PRIVATE_KEY`
     - `MCP_JWT_ISSUER`
     - `MCP_JWT_AUDIENCE`
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - Any other `NEXT_PUBLIC_*` or server-only vars used by the app
   - Alternatively, manage via Wrangler locally: `wrangler secret put NAME --env preview|production`

5. Routes and domains
   - Start with `workers_dev = true` in both envs for safety
   - When ready for a custom domain, edit `wrangler.toml` production env:
     - Remove `workers_dev = true`
     - Add `routes = ["your-domain.com/*"]`

### Local development and preview

- Build locally: `npm run build`
- Workers preview: `npm run preview:local`

### Health checks

- `GET /healthz` → 200 OK
- `GET /version` → returns `{ version }`

### Notes

- Do not commit secrets. Use Cloudflare environment secrets per environment.
- Only add KV/R2/D1/Durable Objects bindings in `wrangler.toml` when the code references them.


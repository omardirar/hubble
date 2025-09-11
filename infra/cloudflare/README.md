# Cloudflare Infrastructure

## Workers Configuration

- **Web app**: `apps/web/wrangler.toml` (OpenNext worker for Next.js)
- **API worker**: `apps/api/wrangler.toml` (Cloudflare Worker with routing)

## Deployment Strategy

### Domain Configuration

- **Preview**: `*.workers.dev` subdomains for development and testing
  - Web: `hubble-frontend-preview.workers.dev`
  - API: `hubble-api-preview.workers.dev`
- **Production**: `*.workers.dev` subdomains for live deployment
  - Web: `hubble-frontend.workers.dev`
  - API: `hubble-api.workers.dev`

### Environment Separation

Both workers use environment-specific configurations:

- `[env.preview]` - Development and testing environment
- `[env.production]` - Live production environment

## Required Cloudflare Resources

### API Worker Bindings

#### API Worker KV Namespaces

```bash
# Create preview KV namespaces
wrangler kv:namespace create CACHE_KV --preview
wrangler kv:namespace create SESSION_KV --preview

# Create production KV namespaces
wrangler kv:namespace create CACHE_KV
wrangler kv:namespace create SESSION_KV

# Production KV Namespace IDs (API Worker):
# CACHE_KV: 7e135cb1c36b43a1983db2ccc3c75944
# SESSION_KV: 9c5bd7b69de74ad3a8e438130759c135
```

#### API Worker D1 Databases

```bash
# Create workflow databases
wrangler d1 create hubble-workflows-preview
wrangler d1 create hubble-workflows-production

# Production D1 Database ID (API Worker):
# hubble-workflows-production: ed66b90a-fc8e-4684-ae72-29b61baf4e30
```

#### API Worker Queues

```bash
# Create provisioning queues
wrangler queues create provisioning-queue-preview
wrangler queues create provisioning-queue-production
```

#### API Worker R2 Buckets

```bash
# Create temporary storage buckets
wrangler r2 bucket create hubble-temp-preview
wrangler r2 bucket create hubble-temp-production
```

### Web App Bindings

#### Web App KV Namespaces

```bash
# Create frontend KV namespaces (separate from API)
wrangler kv:namespace create CACHE_KV --preview --compatibility-date 2025-09-05
wrangler kv:namespace create SESSION_KV --preview --compatibility-date 2025-09-05
wrangler kv:namespace create WEB_CACHE_KV --compatibility-date 2025-09-05
wrangler kv:namespace create WEB_SESSION_KV --compatibility-date 2025-09-05

# Production KV Namespace IDs (Web App):
# WEB_CACHE_KV: 336164029cba402298ad12b566085938
# WEB_SESSION_KV: 25a2577cd3c94458987b5ecd534f35b4
```

#### Web App R2 Buckets

```bash
# Create upload and static asset buckets
wrangler r2 bucket create hubble-uploads-preview
wrangler r2 bucket create hubble-static-preview
wrangler r2 bucket create hubble-uploads-production
wrangler r2 bucket create hubble-static-production
```

## Environment Variables

### API Worker

| Variable       | Preview Value                            | Production Value                 | Description              |
| -------------- | ---------------------------------------- | -------------------------------- | ------------------------ |
| `ENVIRONMENT`  | `preview`                                | `production`                     | Deployment environment   |
| `API_BASE_URL` | `https://hubble-api-preview.workers.dev` | `https://hubble-api.workers.dev` | API base URL             |
| `LOG_LEVEL`    | `debug`                                  | `info`                           | Logging verbosity        |
| `CACHE_TTL`    | `300`                                    | `3600`                           | Cache timeout in seconds |

### Web App

| Variable              | Preview Value                                 | Production Value                      | Description              |
| --------------------- | --------------------------------------------- | ------------------------------------- | ------------------------ |
| `ENVIRONMENT`         | `preview`                                     | `production`                          | Deployment environment   |
| `NEXT_PUBLIC_APP_URL` | `https://hubble-frontend-preview.workers.dev` | `https://hubble-frontend.workers.dev` | Frontend base URL        |
| `API_BASE_URL`        | `https://hubble-api-preview.workers.dev`      | `https://hubble-api.workers.dev`      | API endpoint URL         |
| `LOG_LEVEL`           | `debug`                                       | `info`                                | Logging verbosity        |
| `CACHE_TTL`           | `300`                                         | `3600`                                | Cache timeout in seconds |

## Required Secrets

Configure these secrets via Cloudflare Dashboard or Wrangler:

```bash
# Authentication secrets
wrangler secret put CLERK_SECRET_KEY
wrangler secret put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Database secrets
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# AI/External services
wrangler secret put ANTHROPIC_API_KEY
```

## Workflows

### Provisioning Workflow Pattern

- **Trigger**: API endpoint `/v1/connect/enable`
- **Queue**: `PROVISIONING_QUEUE` for async processing
- **State**: Stored in `WORKFLOW_DB` D1 database
- **Compensation**: Automated rollback on failure
- **Monitoring**: Progress tracking via workflow events

### Common Workflow Topologies

1. **Linear**: Step-by-step provisioning with checkpoints
2. **Parallel**: Concurrent resource creation with synchronization
3. **Conditional**: Branch-based flows with dynamic routing
4. **Retry**: Exponential backoff with maximum retry limits

### Local Testing

```bash
# Test API worker locally
cd apps/api
pnpm dev

# Test web app locally with OpenNext
cd apps/web
pnpm dev

# Preview deployment without publishing
wrangler deploy --dry-run --env preview
```

## Security Configuration

### CORS Settings

Configure R2 buckets with appropriate CORS policies:

```json
{
  "AllowedOrigins": [
    "https://hubble-frontend.workers.dev",
    "https://hubble-frontend-preview.workers.dev"
  ],
  "AllowedMethods": ["GET", "PUT", "POST"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}
```

### Content Security Policy

Implement CSP headers for production deployment with appropriate nonces and sources.

## Monitoring and Observability

### Logging Strategy

- **Preview**: 100% sampling with debug level
- **Production**: 10% sampling with info level
- **Retention**: 7 days preview, 30 days production
- **Sinks**: Workers Analytics + Logpush integration

### Performance Monitoring

- Edge response times via Cloudflare Analytics
- Error rates and status code distribution
- Cache hit ratios for KV and R2 operations
- Queue processing metrics and latency

## Deployment Process

### GitHub Actions Deployment (Recommended)

Deployments are handled automatically via GitHub Actions using the official [Cloudflare Wrangler Action](https://github.com/marketplace/actions/deploy-to-cloudflare-workers-with-wrangler):

#### Preview Deployments

- **Trigger**: Pull requests to `main` branch
- **Workflow**: `.github/workflows/deploy-preview.yml`
- **Process**:
  1. Deploys API worker first
  2. Deploys web app after API worker succeeds
- **URLs**:
  - API: `https://hubble-api-preview.workers.dev`
  - Web: `https://hubble-frontend-preview.github-cc7.workers.dev`

#### Production Deployments

- **Trigger**: Pushes to `main` branch
- **Workflow**: `.github/workflows/deploy-prod.yml`
- **Process**:
  1. Deploys API worker first
  2. Deploys web app after API worker succeeds
- **URLs**:
  - API: `https://hubble-api.workers.dev`
  - Web: `https://hubble-frontend.github-cc7.workers.dev`

#### Manual Deployments

- **Trigger**: Workflow dispatch from GitHub Actions tab
- **Available for**: Both preview and production environments
- **Use case**: Emergency deployments or testing

### Manual Deployment (Local)

```bash
# Deploy API worker (preview)
cd apps/api && pnpm deploy:preview

# Deploy web app (preview)
cd apps/web && pnpm deploy:preview

# Deploy API worker (production)
cd apps/api && pnpm deploy:prod

# Deploy web app (production)
cd apps/web && pnpm deploy:prod
```

### Secret Management

Use the dedicated workflow for managing secrets:

- **Workflow**: `.github/workflows/manage-secrets.yml`
- **Actions**: List or update secrets for specific environments
- **Trigger**: Manual workflow dispatch
- **Secrets managed**:
  - API Worker: `CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Web App: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## Troubleshooting

### Common Issues

1. **Binding Not Found**: Ensure resource IDs match wrangler.toml configuration
2. **KV Namespace Not Valid**: Create the required KV namespaces before deployment
3. **CORS Errors**: Verify R2 bucket CORS policies allow workers.dev origins
4. **Environment Variables**: Check secret values are set for target environment
5. **Queue Processing**: Monitor queue consumer health and retry patterns
6. **OpenNext Build Issues**: Fixed by disabling experimental bundling and minification

### Validation Commands

```bash
# Validate wrangler configuration
wrangler config

# Test worker deployment (dry run)
wrangler deploy --dry-run --env preview

# Check binding status
wrangler kv:namespace list
wrangler r2 bucket list
wrangler queues list

# Test web app deployment (after creating resources)
cd apps/web && pnpm deploy:preview
```

### OpenNext Build Fix

The OpenNext Cloudflare adapter had build issues that have been resolved by:

1. Removing `experimentalBundledNextServer: true` from `open-next.config.ts`
2. Disabling minification to avoid TypeScript file path issues
3. Using standard Next.js server bundling approach

This ensures reliable builds while maintaining functionality.

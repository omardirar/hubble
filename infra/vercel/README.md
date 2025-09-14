# Vercel Infrastructure

## Deployment Configuration

- **Web app**: `apps/web/vercel.json` (Next.js deployment)
- **API functions**: `apps/api/vercel.json` (Serverless functions)

## Authentication Integration

This project uses the **native Clerk-Supabase integration** with a **proxy architecture**, which is the recommended approach as of 2024. This provides:

- **Better Security**: Centralized authentication in API functions
- **Easier Maintenance**: No JWT secret rotation issues
- **Better Performance**: Optimized for serverless environments
- **Future-Proof**: Supported approach going forward
- **Centralized Auth**: All authentication logic in API functions
- **Enhanced Security**: No client-side database credentials

### Architecture

```text
Browser → Next.js API Routes → Vercel Functions → Supabase
```

- **Browser**: Uses `apiFetch` for all database operations
- **Next.js API Routes**: Proxy requests to API functions with Clerk JWT tokens
- **Vercel Functions**: Uses environment variables for database operations
- **Supabase**: Enforces RLS policies based on Clerk JWT claims

## Deployment Strategy

### Domain Configuration

- **Preview**: `*.vercel.app` subdomains for development and testing
  - Web: `hubble-web-preview.vercel.app`
  - API: `hubble-api-preview.vercel.app`
- **Production**: `*.vercel.app` subdomains for live deployment
  - Web: `hubble-web.vercel.app`
  - API: `hubble-api.vercel.app`

### Environment Separation

Both applications use environment-specific configurations:

- `preview` - Development and testing environment
- `production` - Live production environment

## Required Environment Variables

### API Functions

| Variable                    | Description            |
| --------------------------- | ---------------------- |
| `CLERK_SECRET_KEY`          | Clerk secret key       |
| `ANTHROPIC_API_KEY`         | Anthropic API key      |
| `SUPABASE_URL`              | Supabase project URL   |
| `SUPABASE_ANON_KEY`         | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role  |

### Web App

| Variable                            | Description            |
| ----------------------------------- | ---------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key       |
| `NEXT_PUBLIC_API_BASE_URL`          | API functions base URL |

## Deployment Process

### GitHub Actions Deployment (Recommended)

Deployments are handled automatically via GitHub Actions using the Vercel CLI:

#### Preview Deployments

- **Trigger**: Pull requests to `main` branch
- **Workflow**: `.github/workflows/deploy-vercel-preview.yml`
- **Process**:
  1. Deploys API functions first
  2. Deploys web app after API functions succeed
- **URLs**:
  - API: `https://hubble-api-preview.vercel.app`
  - Web: `https://hubble-web-preview.vercel.app`

#### Production Deployments

- **Trigger**: Pushes to `main` branch
- **Workflow**: `.github/workflows/deploy-vercel-prod.yml`
- **Process**:
  1. Deploys API functions first
  2. Deploys web app after API functions succeed
- **URLs**:
  - API: `https://hubble-api.vercel.app`
  - Web: `https://hubble-web.vercel.app`

#### Manual Deployments

- **Trigger**: Workflow dispatch from GitHub Actions tab
- **Available for**: Both preview and production environments
- **Use case**: Emergency deployments or testing

### Local Development

```bash
# Start API functions locally
cd apps/api && pnpm dev

# Start web app locally
cd apps/web && pnpm dev
```

## Environment Variables Management

### Setting Environment Variables

**1. Via Vercel Dashboard:**

- Navigate to Project → Settings → Environment Variables
- Add variables for preview/production environments
- Mark sensitive variables as "Sensitive"

**2. Via Vercel CLI:**

```bash
# Set environment variables
vercel env add CLERK_SECRET_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add SUPABASE_URL production
```

**3. Required GitHub Secrets:**

For CI/CD workflows, configure these in your GitHub repository:

**Secrets** (Settings → Secrets and variables → Actions):

- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_API_PROJECT_ID`: Vercel project ID for API functions
- `VERCEL_WEB_PROJECT_ID`: Vercel project ID for web app
- `TURBO_TOKEN`: Turbo remote cache token

**Variables** (Settings → Secrets and variables → Actions):

- `TURBO_TEAM`: Your Turbo team name

## Performance Optimization

All workflows are optimized with:

- **Turbo Cache**: Remote caching enabled for faster builds
- **pnpm Cache**: Node.js package caching for faster dependency installation
- **Sequential Deployment**: API deployed first, then web app for consistency
- **Incremental Builds**: Only changed packages are rebuilt when possible

## Troubleshooting

### Common Issues

1. **Build Failures**: Check Node.js version compatibility (20.x)
2. **Environment Variables**: Verify all required variables are set
3. **Function Timeouts**: Increase timeout in vercel.json if needed
4. **CORS Errors**: Verify API URLs in proxy configuration

### Validation Commands

```bash
# Test local development
cd apps/api && pnpm dev
cd apps/web && pnpm dev

# Build locally to verify
pnpm build

# Deploy to preview for testing
vercel --prod false
```

## Security Configuration

### CORS Settings

API functions automatically handle CORS for the web app origin.

### Content Security Policy

The Next.js app includes CSP headers configured for Vercel deployment with appropriate sources for Clerk and API functions.

## Monitoring and Observability

### Performance Monitoring

- Function execution times via Vercel Analytics
- Error rates and status code distribution
- Build and deployment metrics

### Logging Strategy

- Function logs available in Vercel dashboard
- Structured logging with appropriate log levels
- Error tracking with stack traces

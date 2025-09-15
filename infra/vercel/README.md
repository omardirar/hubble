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

### Manual Deployment (Recommended)

Deployments are handled manually via Vercel CLI or dashboard:

#### Preview Deployments

```bash
# Deploy API functions to preview
cd apps/api && vercel

# Deploy web app to preview
cd apps/web && vercel
```

#### Production Deployments

```bash
# Deploy API functions to production
cd apps/api && vercel --prod

# Deploy web app to production
cd apps/web && vercel --prod
```

#### Automatic Git Integration

- **Preview**: Automatic deployment on pull requests (if Git integration enabled)
- **Production**: Automatic deployment on pushes to main branch (if Git integration enabled)
- **URLs**: Provided by Vercel after deployment

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

**3. Vercel CLI Setup:**

For manual deployments, install and configure Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to your account
vercel login

# Link projects (run in each app directory)
cd apps/api && vercel --confirm
cd apps/web && vercel --confirm
```

## Performance Optimization

Deployments are optimized with:

- **Build Caching**: Vercel automatically caches builds for faster deployments
- **pnpm Package Manager**: Fast, efficient dependency management
- **Turbo Builds**: Monorepo-aware builds with task caching
- **Edge Functions**: API functions deployed to edge locations
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

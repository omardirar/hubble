# Agent Backend Deployment Guide

This guide covers deploying the Pydantic AI agent backend to Fly.io.

## Prerequisites

- Fly.io account and CLI installed
- GitHub repository with secrets configured
- Environment variables set up

## Local Development

### Start All Services

```bash
# Start all services (dashboard, agents, MCP)
pnpm dev

# Or start individually
pnpm --filter @hubble/dashboard dev  # Dashboard (port 3000)
pnpm dev:agents                      # Agent backend (port 8001)
pnpm dev:mcp                         # MCP servers (ports 8001+)
```

### Environment Setup

Create `.env.local` in the root directory:

```bash
# Agent Backend
AGENT_BACKEND_URL=http://localhost:8001
AGENT_BACKEND_TIMEOUT_MS=30000

# Security
SERVICE_AUTH_SECRET=your-256-bit-secret-generate-with-openssl-rand-hex-32

# Existing vars
ANTHROPIC_API_KEY=your_key
MOTHERDUCK_SERVICE_SECRET=your_secret
```

## Fly.io Deployment

### 1. Deploy Agent Backend

```bash
# Navigate to agent backend service
cd services/agents

# Deploy to Fly.io (uses services/agents/fly.toml)
fly deploy
```

### 2. Deploy MCP Server

```bash
# Navigate to MCP gateway
cd services/mcp

# Deploy to Fly.io (uses services/mcp/fly.toml)
fly deploy
```

### 3. Configure Secrets

Set environment variables via Fly.io secrets:

```bash
# Agent Backend Secrets
flyctl secrets set ANTHROPIC_API_KEY=your_key --app hubble-agent-backend
flyctl secrets set MCP_SERVER_URL=https://hubble-mcp-motherduck.fly.dev --app hubble-agent-backend
flyctl secrets set DASHBOARD_URL=https://your-dashboard.vercel.app --app hubble-agent-backend
flyctl secrets set SERVICE_AUTH_SECRET=your-secret --app hubble-agent-backend
flyctl secrets set ENVIRONMENT=production --app hubble-agent-backend

# MCP Server Secrets
flyctl secrets set MOTHERDUCK_SERVICE_SECRET=your_secret --app hubble-mcp-motherduck
```

### 4. Update Dashboard Environment

In your Vercel dashboard, set these environment variables:

```bash
AGENT_BACKEND_URL=https://hubble-agent-backend.fly.dev
AGENT_BACKEND_TIMEOUT_MS=30000
SERVICE_AUTH_SECRET=your-secret
```

## Monitoring

### Health Checks

```bash
# Check agent backend health
curl https://hubble-agent-backend.fly.dev/health

# Check MCP server health
curl https://hubble-mcp-motherduck.fly.dev/health
```

### Logs

```bash
# View agent backend logs
fly logs --app hubble-agent-backend

# View MCP server logs
fly logs --app hubble-mcp-motherduck
```

### Scaling

```bash
# Scale agent backend
fly scale count 2 --app hubble-agent-backend

# Scale MCP server
fly scale count 2 --app hubble-mcp-motherduck
```

## Security

### Service Authentication

The agent backend uses HMAC-based service tokens for authentication:

1. **Token Creation**: Dashboard creates signed tokens with user/org context
2. **Token Verification**: Agent backend verifies HMAC signatures
3. **Expiration**: Tokens expire after 5 minutes
4. **Rate Limiting**: 100 requests per minute per user

### Security Headers

All responses include security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Check `SERVICE_AUTH_SECRET` is the same in both services
   - Verify token expiration (5 minutes max)

2. **Connection Errors**
   - Ensure `AGENT_BACKEND_URL` is correct in dashboard
   - Check Fly.io app is running: `fly status`

3. **MCP Connection Issues**
   - Verify `MCP_SERVER_URL` in agent backend
   - Check MCP server health endpoint

### Debug Mode

Enable debug logging:

```bash
fly secrets set LOG_LEVEL=DEBUG --app hubble-agent-backend
```

### Performance

Monitor performance metrics:

- CPU usage: `fly metrics --app hubble-agent-backend`
- Memory usage: `fly metrics --app hubble-agent-backend`
- Request latency: Check Fly.io dashboard

## CI/CD

GitHub Actions automatically deploy on push to main:

- **Agent Backend**: Deploys when `services/agents/**` changes
- **MCP Server**: Deploys when `services/mcp/**` changes
- **Security**: Runs safety and bandit scans before deployment
- **Testing**: Runs pytest with coverage reporting

## Rollback

If deployment fails:

```bash
# Rollback to previous version
fly releases --app hubble-agent-backend
fly deploy --app hubble-agent-backend --image <previous-image>
```

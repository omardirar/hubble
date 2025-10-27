# Hubble MCP MotherDuck Server

MCP server for MotherDuck database access in the Hubble ecosystem.

## Overview

This MCP server provides secure, multi-tenant access to MotherDuck databases. It:

- Authenticates requests using Clerk JWT tokens
- Scopes database connections to organizations via `org_id`
- Executes SQL queries against organization-specific MotherDuck instances

## Authentication Architecture

### How It Works

1. **Client Request**: Dashboard/API sends request with:
   - `Authorization: Bearer <clerk-jwt>` - Contains user identity and `org_id`
   - `X-MotherDuck-Service-Secret: <token>` - MotherDuck service account token

2. **JWT Verification**: Server verifies JWT using Clerk SDK and extracts `org_id`

3. **Connection Scoping**: Automatically connects to `md:md_{org_id}` database

4. **Query Execution**: Runs SQL queries in organization's isolated database

### Security Model

- **Multi-tenancy**: Each organization has its own MotherDuck database (`md_org_123abc`)
- **JWT validation**: Cryptographic verification prevents token forgery
- **Token resolution**: MotherDuck tokens retrieved from Supabase by Agents API (never exposed to clients)
- **RLS alignment**: Uses same `org_id` claim as Supabase Row-Level Security

## Configuration

### Environment Variables

**Required:**

- `CLERK_SECRET_KEY` - Clerk secret key for JWT verification
- `MOTHERDUCK_TOKEN` - Fallback MotherDuck token (optional, tokens usually provided per-request)

**Optional:**

- `LOG_LEVEL` - Logging level (default: `INFO`)
- `MOTHERDUCK_LOG_LEVEL` - Override log level for this service

### Example

```bash
# .env (local development)
CLERK_SECRET_KEY=sk_test_...
LOG_LEVEL=DEBUG
```

## Local Development

```bash
# Install dependencies with uv
uv sync

# Start development server (from services/mcp)
pnpm dev:motherduck

# Or run via Turborepo from repo root
pnpm --filter @hubble/mcp dev:motherduck
```

### Testing with curl

```bash
# Get a Clerk JWT from your dashboard session
export JWT="eyJhbGc..."
export MD_TOKEN="your_motherduck_token"

curl -X POST http://localhost:8000/mcp \
  -H "Authorization: Bearer $JWT" \
  -H "X-MotherDuck-Service-Secret: $MD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method": "query", "params": {"query": "SELECT 1"}}'
```

## Testing

```bash
# Type check
uv run mypy src/motherduck/

# Lint
uv run ruff check

# Format
uv run ruff format

# All checks
uv run mypy src/motherduck/ && uv run ruff check
```

## Deployment

### Fly.io

```bash
# Set secrets
fly secrets set CLERK_SECRET_KEY=sk_live_...

# Deploy
fly deploy

# View logs
fly logs

# Scale
fly scale count 2
```

### Environment Variables (Production)

**Required Secrets:**

- `CLERK_SECRET_KEY` - Production Clerk secret key

**Optional:**

- `LOG_LEVEL=INFO` - Production log level

## API Reference

### Headers

**Authentication Headers (required):**

```text
Authorization: Bearer <clerk-jwt>
X-MotherDuck-Service-Secret: <motherduck-token>
```

**Alternative Headers (supported):**

- `X-MD-Service-Secret` - Alternate for MotherDuck token

### MCP Methods

#### `query`

Execute SQL query against organization's MotherDuck database.

**Parameters:**

- `query` (string): SQL query to execute
- `format` (string, optional): Response format - `text` (default) or `arrow`
- `preview_rows` (int, optional): Number of preview rows for Arrow format (default: 20)

**Example:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "query",
    "arguments": {
      "query": "SELECT * FROM marketing_campaigns LIMIT 10",
      "format": "text"
    }
  }
}
```

## Architecture

### Database Scoping

Connections are automatically scoped to organization databases:

```python
# JWT contains: {"org_id": "org_330a2TFzTlTTtUj0uDHfWb6kOJ5"}
# → Connects to: md:md_org_330a2TFzTlTTtUj0uDHfWb6kOJ5
```

### Integration with Agents API

The Agents API resolves MotherDuck tokens from Supabase:

```python
# services/agents/src/h10s/db/repositories/motherduck.py
mcp_headers = await motherduck_repo.build_mcp_headers(org_id)
# Returns: {"x-motherduck-service-secret": "<token_from_supabase>"}
```

These headers are passed to the MCP client, which forwards them to this server.

## Troubleshooting

### Common Issues

#### 401 Unauthorized - Missing Authorization header

- Ensure `Authorization: Bearer <jwt>` header is present
- JWT must be valid Clerk token with `org_id` claim

#### 401 Unauthorized - Missing MotherDuck service secret header

- Ensure `X-MotherDuck-Service-Secret` header is present
- Token should be retrieved from Supabase (`public.get_secret(org_id, 'md_sa_token')`)

#### 401 Unauthorized - Invalid or expired JWT

- JWT has expired (check `exp` claim)
- JWT signature invalid (check `CLERK_SECRET_KEY`)

#### 401 Unauthorized - Missing org_id in JWT claims

- User is not associated with an organization in Clerk
- JWT was issued before user joined organization (re-authenticate)

### Debug Logging

```bash
# Enable debug logs
export LOG_LEVEL=DEBUG
mcp-server-motherduck --transport stream --port 8000
```

# Hubble MCP MotherDuck Server

MCP server for MotherDuck database access in the Hubble ecosystem.

## Local Development

```bash
# Install dependencies with uv
uv sync

# Start development server (from services/mcp)
pnpm dev:motherduck

# Or run via Turborepo from repo root
pnpm --filter @hubble/mcp dev:motherduck
```

## Testing

```bash
# Run checks (no formal test suite yet)
uv run ruff check

# Format
uv run ruff format

# Run security checks
safety check
bandit -r motherduck/
```

## Deployment

```bash
# Deploy to Fly.io
fly deploy

# View logs
fly logs

# Scale
fly scale count 2
```

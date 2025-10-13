# Hubble MCP Gateway

Multi-MCP server deployment with Caddy reverse proxy, powered by `uv`.

## Servers

- **MotherDuck**: SQL queries against MotherDuck databases
- **Dice Roll**: Simple dice rolling for testing

## Local Development

```bash
# Sync dependencies (first time)
pnpm sync:mcp

# Start all MCP servers
pnpm dev:mcp

# Or use turbo directly
turbo dev --filter=@hubble/mcp

# Test with MCP Inspector
pnpm inspector:motherduck  # Port 6274
pnpm inspector:dice        # Port 6275
```

## Adding New MCP Server

1. Create directory: `services/mcp/new-server/`
2. Add `pyproject.toml` with dependencies
3. Update workspace: `services/mcp/pyproject.toml`
4. Add to Dockerfile, start.sh, Caddyfile
5. Add dev script to `package.json`

No venv setup needed - `uv run` handles everything!

## Deployment

Deployment to Fly.io happens automatically via GitHub Actions when you push to `main`:

- Triggers on changes to `services/mcp/**`
- Monitor at: <https://github.com/omzification/hubble/actions>

### Manual Deployment (if needed)

```bash
cd services/mcp
fly deploy
```

But this is discouraged - use GitHub Actions for consistency.

## URLs

- Production: `https://mcp.hubble.systems/`
  - MotherDuck: `https://mcp.hubble.systems/motherduck`
  - Dice Roll: `https://mcp.hubble.systems/dice-roll`

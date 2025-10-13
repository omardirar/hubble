# MCP Architecture Documentation

## Overview

The Hubble MCP Gateway provides a unified deployment for multiple Model Context Protocol (MCP) servers using Caddy as a reverse proxy.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Fly.io Deployment                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                Caddy Reverse Proxy                     │ │
│  │  Port 8080 (External)                                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ MotherDuck MCP  │  │  Dice Roll MCP  │  │ Health Check│ │
│  │ Port 8001       │  │ Port 8002       │  │ /health     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## URL Routing

- `/health` → Health check endpoint
- `/motherduck/*` → MotherDuck MCP server (port 8001)
- `/dice-roll/*` → Dice Roll MCP server (port 8002)

## Adding New MCP Servers

1. **Create server directory**:

   ```bash
   mkdir services/mcp/new-server
   ```

2. **Add server configuration**:

   ```python
   # services/mcp/new-server/src/server.py
   from mcp.server import Server
   # ... implement MCP server
   ```

3. **Update Dockerfile**:

   ```dockerfile
   # Add to installation step
   RUN pip install --no-cache-dir -e ./new-server
   ```

4. **Update start.sh**:

   ```bash
   # Add new server
   uvicorn new_server:app --host 0.0.0.0 --port 8003 &
   ```

5. **Update Caddyfile**:

   ```caddyfile
   # Add new route
   handle /new-server* {
       uri strip_prefix /new-server
       reverse_proxy localhost:8003
   }
   ```

6. **Update package.json**:

   ```json
   {
     "scripts": {
       "dev:new-server": "cd new-server && uvicorn new_server:app --reload --port 8003"
     }
   }
   ```

## Health Checks

Each MCP server should implement a health check endpoint:

```python
async def health_check(request):
    return JSONResponse({"status": "healthy", "service": "server-name"})
```

## Development Workflow

1. **Local Development**:

   ```bash
   # Start individual servers
   pnpm --filter @hubble/mcp dev:motherduck
   pnpm --filter @hubble/mcp dev:dice

   # Test with MCP Inspector
   pnpm inspector:motherduck
   pnpm inspector:dice
   ```

2. **Docker Testing**:

   ```bash
   cd services/mcp
   docker build -t hubble-mcp:test .
   docker run -p 8080:8080 hubble-mcp:test
   ```

3. **Deployment**:

   ```bash
   pnpm deploy:mcp
   ```

## Monitoring

- **Health**: `GET /health`
- **MotherDuck**: `GET /motherduck/health`
- **Dice Roll**: `GET /dice-roll/health`

## Security

- All servers run as non-root user
- Caddy handles HTTPS termination
- Internal communication over localhost
- No external access to individual servers

## Troubleshooting

1. **Server not starting**: Check logs with `fly logs`
2. **Routing issues**: Verify Caddyfile configuration
3. **Health check failures**: Ensure servers implement health endpoints
4. **Port conflicts**: Update port assignments in start.sh and Caddyfile

#!/usr/bin/env bash
set -euo pipefail

# Start MotherDuck MCP server on :9001 (HTTP streamable transport)
EXTRA_ARGS=()
if [ -n "${MOTHERDUCK_TOKEN:-}" ]; then
  EXTRA_ARGS+=(--motherduck-token "${MOTHERDUCK_TOKEN}")
fi

python -m motherduck.server \
  --transport stream \
  --port 9001 \
  --db-path md: \
  "${EXTRA_ARGS[@]}" \
  --json-response \
  --saas-mode &
MD_PID=$!

# (Optional) Start additional MCP servers on different ports (HTTP streamable):
# uvx some-other-mcp-server --transport stream --port 9002 &

# Start Caddy reverse proxy on externally-visible port (default 8080)
PORT="${PORT:-8080}"
export PORT
echo "[start.sh] Launching Caddy on port ${PORT}"
caddy run --config /app/Caddyfile &
CADDY_PID=$!

# Wait on critical processes
wait -n "$MD_PID" "$CADDY_PID"

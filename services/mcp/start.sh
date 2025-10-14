#!/bin/bash
set -euo pipefail

pids=()

term_handler() {
  echo "Received termination signal, shutting down..."
  for pid in "${pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait || true
  exit 0
}

trap term_handler SIGTERM SIGINT

# Start MotherDuck MCP on port 8001
uvicorn motherduck.app:app --host 0.0.0.0 --port 8001 &
pids+=($!)

# Start Caddy reverse proxy on port 8080 in foreground (PID 1 replacement)
# Use exec so signals reach Caddy; the trap handles the others
exec caddy run --config /app/Caddyfile --adapter caddyfile

#!/bin/bash
set -e

# Start MotherDuck MCP on port 8001
uvicorn motherduck.server:app --host 0.0.0.0 --port 8001 &

# Start Dice Roll MCP on port 8002
uvicorn dice_roll:app --host 0.0.0.0 --port 8002 &

# Start Caddy reverse proxy on port 8080
caddy run --config /app/Caddyfile --adapter caddyfile

# Wait for all background processes
wait

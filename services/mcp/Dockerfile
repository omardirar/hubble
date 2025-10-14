# Base with uv on Debian
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1

WORKDIR /app

# --- Bring in Caddy from Debian-based image (NOT alpine) ---
FROM caddy:2.10.2 AS caddy

# --- Final stage ---
FROM base

# Create non-root early so we can copy with --chown
RUN useradd --create-home --shell /bin/bash app

# Copy Caddy binary from Debian-based image
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy

# Install system packages you might need (optional but handy)
# RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Leverage layer cache: copy just project metadata first
# (adjust these to match your project layout)
COPY motherduck/pyproject.toml ./motherduck/pyproject.toml

# If you use uv.lock, include those too:
# COPY motherduck/uv.lock ./motherduck/uv.lock
# COPY dice-roll/uv.lock ./dice-roll/uv.lock

# Now copy the actual source
COPY --chown=app:app motherduck/ ./motherduck/
COPY --chown=app:app Caddyfile ./Caddyfile
COPY --chown=app:app start.sh ./start.sh

# Install dependencies and ensure start script is executable
RUN uv pip install --no-cache -e ./motherduck && \
    chmod +x /app/start.sh

USER app

EXPOSE 8080

# Healthcheck via Caddy
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8080/health || exit 1

CMD ["./start.sh"]

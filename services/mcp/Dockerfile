FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim as base

WORKDIR /app

# Install Caddy
FROM caddy:2-alpine as caddy

# Final stage
FROM base

# Copy Caddy binary
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy

# Copy all MCP server code
COPY motherduck/ ./motherduck/
COPY dice-roll/ ./dice-roll/
COPY Caddyfile ./Caddyfile
COPY start.sh ./start.sh

# Use uv to install without venv (system mode)
ENV UV_SYSTEM_PYTHON=1
RUN uv pip install --no-cache ./motherduck ./dice-roll && \
    chmod +x start.sh && \
    useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

EXPOSE 8080

CMD ["./start.sh"]

FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates dumb-init caddy \
  && useradd -m appuser \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install local MotherDuck MCP server from source path
COPY motherduck /app/motherduck
RUN pip install --no-cache-dir /app/motherduck

USER appuser

EXPOSE 8080

COPY --chown=appuser:appuser Caddyfile /app/Caddyfile
COPY --chown=appuser:appuser start.sh /app/start.sh
RUN chmod +x /app/start.sh

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/app/start.sh"]

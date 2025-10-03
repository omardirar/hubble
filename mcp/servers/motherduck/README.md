# MotherDuck MCP Server (Local Package)

This directory contains the local source for the MotherDuck MCP server, packaged as part of the container image that runs on AWS App Runner (or any other OCI-compatible runtime).

- Console script: `mcp-server-motherduck`
- Module: `motherduck.server`

For usage and deployment, see the root repository README.

## HTTP/SSE Auth & Scoping

When running with `--transport stream` or `--transport sse`, each request must include:

- `X-MotherDuck-Service-Secret` (or `X-MD-Service-Secret`) containing the tenant's MotherDuck service account secret
- `X-MotherDuck-Connection` (or `X-MD-Connection`) with the target connection URI (e.g. `md:md_org_330a2TFzTlTTtUj0uDHfWb6kOJ5`)

The server opens a short-lived DuckDB connection per request using those values. Secrets are not persisted beyond the request lifecycle.

`MOTHERDUCK_TOKEN` is only required when using `stdio` transport, where all queries run with process-level credentials.

The MCP server is optimized for always-on HTTP transports; prefer `stream` for production deployments.

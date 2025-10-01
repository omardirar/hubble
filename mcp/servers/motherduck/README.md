# MotherDuck MCP Server (Local Package)

- Console script: `mcp-server-motherduck`
- Module: `motherduck.mcp_server`

For usage and deployment, see the root repository README.

## HTTP/SSE Auth & Scoping

When running with `--transport stream` or `--transport sse`, the server expects:

- `Authorization: Bearer <motherduck_token>` on every request
- `X-Db-Name` to choose the target database within the org
- Per‑request connection to `md:<db>` using the supplied token
- Optional `DEFAULT_LIMIT` environment variable (default 500) for downstream consumers

`MOTHERDUCK_TOKEN` is only required when no token is provided per request (e.g., stdio transport).

Stdio transport does not enforce per‑request auth and uses process-level credentials, so it is not recommended for production scoping.
